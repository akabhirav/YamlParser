import Log from "./log";

let removeQuotes = (string) => {
    if (string === undefined)
        return string;
    let replaceDupApos = false;
    if (string.startsWith("'")) {
        replaceDupApos = true;
    }
    string = string.replace(/^['"](.*)['"]$/, '$1');
    if (replaceDupApos)
        string = string.replace("''", "'");
    return string;
};

class Line {
    line;

    static FIRST_CHARACTER = /\S|$/;
    static COMMENTED_LINE = /^(\s+)?#/;
    static COLLECTION_STARTER = /^-/;

    constructor(string) {
        this.line = string || "";
    }

    getIndent = () => {
        if (this.line === "")
            return -1;
        let searchableLine = this.line;
        if (this.isCollectionElement())
            searchableLine = searchableLine.replace(/-/, ' ');
        return searchableLine.search(Line.FIRST_CHARACTER)
    };

    isLineCommented = () => {
        return Line.COMMENTED_LINE.test(this.line);
    };

    removeInlineComments() {
        let commentStartPos = this.line.indexOf(" #");
        if (commentStartPos === -1)
            return;
        this.line = this.line.substring(0, commentStartPos)
    }

    getKeyValue = (toRemoveQuotes) => {
        this.removeInlineComments();
        let onlyValue = this.line.indexOf(":") === -1 || this.line.trim().indexOf(":") === 0;
        let key, value;
        [key, value] = this.line.trim()
            .replace(/^-/, '')
            .split(/:(.*)/).filter(str => !!str).filter(str => str !== " ")
            .map(str => str.trim());
        if (toRemoveQuotes) {
            key = removeQuotes(key);
            value = removeQuotes(value)
        }
        if (onlyValue) {
            return [undefined, key];
        } else {
            return [key, value];
        }

    };

    isEmpty = () => {
        return this.line === null || this.line.trim() === ''
    };

    isCollectionElement = () => {
        return Line.COLLECTION_STARTER.test(this.line.trim());
    };

    isObject = () => {
        return !this.isCollectionElement() && (this.line.indexOf(': ') > -1 || this.line.indexOf(":") === this.line.length - 1)
    };

    notCollectionOrObject = () => {
        return !this.isEmpty() && !this.isCollectionElement() && !this.isObject()
    };

    toString = () => {
        return this.line
    };
}


class YAMLProcessor {
    stringifyOptions = {
        indentation: 2,
        retainInputFormatting: false,
        quoteValues: false,
        quoteKeys: false,
        fieldsToSymbolize: [],
        fieldsToStringify: []
    };

    parseOptions = {
        removeQuotes: true
    };

    data;

    constructor(data) {
        this.data = data;
    }

    stringifyObject(json, startString, indentation, removeFirstIndent = false) {
        let string = startString;
        let indent = this.generateIndentation(indentation);
        Object.keys(json).forEach((key, index) => {
            if (typeof json[key] === 'string' || json[key] === null) {
                string += `${removeFirstIndent && index === 0 ? '' : indent}${this.processKey(key)}:${json[key] === null ? '' : ' '}${this.processValue(json[key], key)}\n`
            } else if (typeof json[key] === 'object') {
                string += `${removeFirstIndent && index === 0 ? '' : indent}${this.processKey(key)}:\n`;
                if (json[key] instanceof Array)
                    string = this.stringifyArray(json[key], string, indentation + 1);
                else {
                    string = this.stringifyObject(json[key], string, indentation + 1);
                }
            }
        });
        return string;
    }

    processKey = (string) => {
        if (!this.stringifyOptions.retainInputFormatting) {
            if (this.stringifyOptions.quoteKeys)
                string = `"${string}"`;
        }
        return string
    };

    processValue = (string, key) => {
        if (string === null)
            string = "";
        if (!this.stringifyOptions.retainInputFormatting) {
            if (this.stringifyOptions.fieldsToSymbolize.includes(key))
                string = `:${string.replace(/"([^"]+(?="))"/g, '$1')}`;
            else if (this.stringifyOptions.fieldsToStringify.includes((key)))
                string = `"${string}"`;
            else if (this.stringifyOptions.quoteValues)
                string = `"${string}"`;
        }
        if (/.*:($| ).*/.test(string)) {
            if (string.indexOf("'")) {
                string = string.replace(/'/g, "''")
            }
            string = `'${string}'`
        }
        return string
    };

    stringifyArray(json, startString, indentation) {
        let string = startString;
        let indent = this.generateIndentation(indentation);
        json.forEach((object) => {
            if (typeof object === 'string' || object === null) {
                string += `${indent}- ${this.processValue(object)}\n`
            } else if (typeof object === 'object') {
                string += `${this.generateIndentation(indentation)}- `;
                string = this.stringifyObject(object, string, indentation + 1, true);
            }
        });
        return string;
    }

    parseArray = (lines, startIndex, startIndent) => {
        let line = new Line(lines[startIndex]);
        let index = startIndex;
        let array = [], currentObject = null;
        while (startIndent <= line.getIndent()) {
            if (line.isCollectionElement()) {
                if (currentObject !== null && Object.keys(currentObject).length)
                    array.push(currentObject);
                currentObject = {};
            }
            let key, value;
            [key, value] = line.getKeyValue(this.parseOptions.removeQuotes);
            if (key in currentObject) {
                Log.error(`Duplicate Key ${key} on line ${index + 1}`)
            }
            index++;
            [value, index] = this.getValue(lines, index, value, startIndent);
            line = new Line(lines[index]);
            let newLineIndent = line.getIndent();
            if (value || value === "" || value === null || (key === undefined && value === undefined)) {
                if (key === undefined) {
                    if (value !== undefined)
                        array.push(value);
                } else
                    currentObject[key] = value;
            } else {
                if (newLineIndent < startIndent)
                    break;
                if (line.isCollectionElement()) {
                    [currentObject[key], index] = this.parseArray(lines, index, newLineIndent);
                } else {
                    [currentObject[key], index] = this.parseObject(lines, index, newLineIndent);
                }
                line = new Line(lines[index]);
            }
        }
        if (Object.keys(currentObject).length)
            array.push(currentObject);
        return [array, index];
    };

    parseObject = (lines, startIndex, startIndent) => {
        let line = new Line(lines[startIndex]);
        let index = startIndex;
        let object = {};
        while (startIndent === line.getIndent()) {
            let key, value;
            [key, value] = line.getKeyValue(this.parseOptions.removeQuotes);
            if (key in object) {
                Log.error(`Duplicate Key ${key} on line ${index + 1}`)
            }
            index++;
            [value, index] = this.getValue(lines, index, value, startIndent);
            line = new Line(lines[index]);
            let newLineIndent = line.getIndent();
            if (value || value === "" || value === null)
                object[key] = value;
            else {
                if (newLineIndent < startIndent)
                    break;
                if (line.isCollectionElement()) {
                    [object[key], index] = this.parseArray(lines, index, newLineIndent);
                } else {
                    [object[key], index] = this.parseObject(lines, index, newLineIndent);
                }
                line = new Line(lines[index]);
            }

        }
        return [object, index];
    };

    getValue = (lines, startIndex, startString, indent) => {
        let index = startIndex;
        let stringArr = [];
        if (startString !== undefined)
            stringArr.push(startString);
        let line = new Line(lines[index]);
        if (!line.notCollectionOrObject() && indent === line.getIndent())
            startString = null;
        while (line.notCollectionOrObject()) {
            stringArr.push(line.getKeyValue(this.parseOptions.removeQuotes)[1].trim());
            index++;
            line = new Line(lines[index]);
        }
        let value = stringArr.join(' ') || startString;
        // noinspection EqualityComparisonWithCoercionJS
        return [(parseFloat(value) == value) ? parseFloat(value) : value, index]
    };

    generateIndentation = (indentation) => {
        let indent = "";
        for (let i = 0; i < indentation * this.stringifyOptions.indentation; i++) {
            indent += " "
        }
        return indent;
    }
}


export default class YAML {

    static parse = (string, parseOptions = {}) => {
        if (!(typeof string === 'string'))
            throw new SyntaxError('Unexpected context, was expecting a string');
        let processor = new YAMLProcessor(string);
        processor.parseOptions = {...processor.parseOptions, ...parseOptions};
        let outputJSON;
        let lines = processor.data.split("\n").filter((line) => {
            let yamlLine = new Line(line);
            return !(yamlLine.isEmpty() || yamlLine.isLineCommented());
        });
        let lowestIndent = Infinity;
        for (let i = 0; i < lines.length; i++) {
            let yamlLine = new Line(lines[i]);
            if (yamlLine.getIndent() < lowestIndent) {
                lowestIndent = yamlLine.getIndent();
            }
            let indent = yamlLine.getIndent();
            if (yamlLine.isCollectionElement()) {
                [outputJSON, i] = processor.parseArray(lines, i, indent)
            } else {
                [outputJSON, i] = processor.parseObject(lines, i, indent)
            }
        }
        return outputJSON;
    };

    static stringify = (object, stringifyOptions = {}) => {
        if (typeof object === 'string')
            return '""';
        let processor = new YAMLProcessor(object);
        processor.stringifyOptions = {...processor.stringifyOptions, ...stringifyOptions};
        let indentation = 0;
        let outputString = "";
        if (processor.data instanceof Array)
            outputString = processor.stringifyArray(processor.data, outputString, indentation);
        else
            outputString = processor.stringifyObject(processor.data, outputString, indentation);
        processor.data = outputString;
        return processor.data;
    };
}
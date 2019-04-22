import Log from "./log";

let removeQuotesFn = (string) => {
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

    getLineIndent = () => {
        if (this.line === "")
            return -1;
        let searchableLine = this.line;
        return searchableLine.search(Line.FIRST_CHARACTER)
    };

    getCollectionIndent = () => {
        return this.line.replace(/(\s*)-/, '$1').search(Line.FIRST_CHARACTER)
    };

    isStartBlock = () => {
        return this.line.indexOf('---') > -1
    };

    isComment = () => {
        return Line.COMMENTED_LINE.test(this.line);
    };

    removeInlineComments() {
        let commentStartPos = this.line.indexOf(" #");
        if (commentStartPos === -1)
            return;
        this.line = this.line.substring(0, commentStartPos)
    }

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

    hasOnlyValue = () => {
        return this.line.toString().indexOf(":") === -1 || this.line.trim().indexOf(":") === 0;
    }
}


class YamlLines {
    lines = [];
    currentIndex = -1;
    maxIndex;

    blockIndentation = [];

    constructor(lines) {
        this.lines = lines.map(line => new Line(line)).filter(line => !(line.isEmpty() || line.isComment() || line.isStartBlock()));
        this.maxIndex = lines.length - 1;
    }

    /**
     * @returns Line Next Line object
     * */
    nextLine = () => {
        return this.lines[++this.currentIndex];
    };

    /**
     * @returns Line Line object for current Line
     * */
    currentLine = () => {
        return this.lines[this.currentIndex];
    };

    /**
     * @returns Number Starting Indentation of last block
     * */
    lastBlockIndent = () => {
        return this.blockIndentation[this.blockIndentation.length - 1];
    };

    startBlock = () => {
        if (this.currentLine().isCollectionElement())
            this.blockIndentation.push(this.currentLine().getCollectionIndent());
        else

            this.blockIndentation.push(this.currentLine().getLineIndent());
    };

    /**
     * @returns Boolean Whether the current line is inside the last block
     * */
    isInsideBlock = () => {
        if (!this.currentLine())
            return false;
        if (this.currentLine().isCollectionElement())
            return this.currentLine().getCollectionIndent() >= this.lastBlockIndent();
        else
            return this.currentLine().getLineIndent() >= this.lastBlockIndent();
    };

    endBlock = () => {
        this.blockIndentation.pop();
    };

    isCollectionElement = () => {
        return this.currentLine().isCollectionElement();
    };

    getKeyValue = (removeQuotes) => {
        this.currentLine().removeInlineComments();
        let onlyValue = this.currentLine().hasOnlyValue();
        let key, value;
        [key, value] = this.currentLine().toString().trim()
            .replace(/^-/, '')
            .split(/:(.*)/).filter(str => !!str).filter(str => str !== " ")
            .map(str => str.trim());
        if (removeQuotes) {
            key = removeQuotesFn(key);
            value = removeQuotesFn(value)
        }
        if (onlyValue) {
            value = key;
            key = undefined;
        }
        let stringArr = [];
        if (value !== undefined)
            stringArr.push(value);
        let indent = this.currentLine().getLineIndent();
        this.nextLine();
        if (this.currentLine() && !this.currentLine().notCollectionOrObject() && indent === this.currentLine().getLineIndent())
            value = null;
        while (this.currentLine() && this.currentLine().notCollectionOrObject() && indent < this.currentLine().getLineIndent()) {
            stringArr.push(this.currentLine().toString().trim());
            this.nextLine();
        }
        value = stringArr.join(' ') || value;
        // noinspection EqualityComparisonWithCoercionJS
        return [key, (parseFloat(value) == value) ? parseFloat(value) : value]
    };

    logError = (message) => {
        Log.error(message + this.currentIndex)
    };
}


let yamlLines;

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

    /**
     * @param {YamlLines, JSON} data Data on which the operations need to run
     * */
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

    generateIndentation = (indentation) => {
        let indent = "";
        for (let i = 0; i < indentation * this.stringifyOptions.indentation; i++) {
            indent += " "
        }
        return indent;
    };

    parseArray = () => {
        yamlLines.startBlock();
        let array = [], currentObject = null;
        do {
            if (yamlLines.isCollectionElement()) {
                if (currentObject !== null && Object.keys(currentObject).length)
                    array.push(currentObject);
                currentObject = {};
            }
            let key, value;
            [key, value] = yamlLines.getKeyValue(this.parseOptions.removeQuotes);
            // if (value || value === "" || value === null || key === undefined || value === undefined) {
            if (key === undefined) {
                if (value !== undefined)
                    array.push(value);
            } else
                currentObject[key] = value;
            // } else {
            //     currentObject[key] = yamlLines.isCollectionElement() ? this.parseArray() : this.parseObject();
            // }
        } while (yamlLines.isInsideBlock());
        yamlLines.endBlock();
        if (Object.keys(currentObject).length)
            array.push(currentObject);
        return array;
    };

    parseObject = () => {
        yamlLines.startBlock();
        let object = {};
        do {
            let key, value;
            [key, value] = yamlLines.getKeyValue(this.parseOptions.removeQuotes);
            if (key in object) {
                yamlLines.logError(`Duplicate Key ${key} on line `);
            }
            if (value || value === "") {
                if (!key)
                    throw SyntaxError('No Key defined for value');
                object[key] = value;
            } else {
                object[key] = yamlLines.isCollectionElement() ? this.parseArray() : this.parseObject();
            }
        } while (yamlLines.isInsideBlock());
        yamlLines.endBlock();
        return object;
    };
}


export default class YAML {

    static parse = (string, parseOptions = {}) => {
        if (!(typeof string === 'string'))
            throw new SyntaxError('Unexpected context, was expecting a string');
        yamlLines = new YamlLines(string.split("\n"));
        let processor = new YAMLProcessor(yamlLines);
        processor.parseOptions = {...processor.parseOptions, ...parseOptions};
        let outputJSON;
        while (yamlLines.nextLine()) {
            outputJSON = yamlLines.isCollectionElement() ? processor.parseArray() : processor.parseObject();
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
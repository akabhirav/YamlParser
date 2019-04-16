const fs = require("fs");


export default class TML {

    content = '';

    getSection = (sectionName) => {
        let sectionText = this.content.split('--- ')
            .filter(section => section.split("\n")[0].indexOf(sectionName) === 0)[0];
        if (!!sectionText)
            return sectionText.replace(sectionName, '');
        return null;
    };

    constructor(filePath) {
        this.content = fs.readFileSync(filePath).toString();
    }

    inputYAML = () => {
        return this.getSection('in-yaml')
            .replace(/<SPC>/g, ' ')
            .replace(/<TAB>/g, '  ')
    };

    hasError = () => {
        return !!this.getSection('error');
    };

    error = () => {
        return this.getSection('error')
    };

    json = () => {
        return JSON.parse(this.getSection('in-json'))
    };

}
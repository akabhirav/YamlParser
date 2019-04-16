#!/usr/bin/env node
import fs from 'fs';
import Log from './log'
import YAML from "./yaml";
if (!process.argv[2]) {
    Log.warning('Please provide a path to the custom YAML file');
    process.exit(1)
}

fs.readFile(process.argv[2], null, (error, data) => {
    if (error) {
        Log.error(error.message);
        process.exit(1)
    }
    let parsedYaml = YAML.parse(data.toString(), { removeQuotes: false });
    let yaml = YAML.stringify(parsedYaml, { retainInputFormatting: true });
    fs.writeFileSync('out.json', JSON.stringify(parsedYaml));
    fs.writeFileSync('out.yml', yaml);
});

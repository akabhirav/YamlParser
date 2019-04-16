import TML from '../tml';

const fs = require("fs");
import assert from 'assert';
import YAML from "../yaml";
import Log from "../log";
// import {describe} from "mocha";
// import should from 'should';
const DIR_NAME = 'test/tmls/';
let fileNames = fs.readdirSync(DIR_NAME);

describe('YAML', function () {
    describe('#parse', function () {
        fileNames.forEach(function (fileName) {
            if (fs.lstatSync(DIR_NAME + fileName).isDirectory())
                return;
            let tml = new TML(DIR_NAME + fileName);
            it(`should pass test for ${fileName}`, function (done) {
                if(tml.hasError())
                    assert.strictEqual(YAML.parse(tml.inputYAML()), tml.error());
                assert.deepStrictEqual(YAML.parse(tml.inputYAML()), tml.json());
                done()
            })
        });
    })
});

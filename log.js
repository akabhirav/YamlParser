export default class Log{
    static ERROR = 'ERROR';
    static INFO = 'INFO';
    static SUCCESS = 'SUCCESS';
    static WARNING = 'WARNING';

    typeColorMap = {
        ERROR: "\x1b[31m",
        INFO: " \x1b[34m",
        SUCCESS: "\x1b[32m",
        WARNING: "\x1b[33m"
    };

    constructor(){
        let args = Object.values(arguments);
        const type = args.shift();
        const message = args.join(' ');
        console.log(this.typeColorMap[type], message);
    }

    static info = (message) => {
        new Log(Log.INFO, message)
    };

    static error = (message) => {
        new Log(Log.ERROR, message)
    };

    static warning = (message) => {
        new Log(Log.WARNING, message)
    };

    static success = (message) => {
        new Log(Log.SUCCESS, message)
    };
}
let commands = [];
const tabCmds = [];

const evt = {
    events: {},
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    },
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach((callback) => callback(data));
        }
    },
};

function gmd(obj, functions) {
    let infoComs = obj;
    if (!obj.category) infoComs.category = "general"; 
    if (!obj.react) infoComs.react = "🚀";
    if (!obj.dontAddCommandList) infoComs.dontAddCommandList = false; 
    const aliasValues = [
        ...(Array.isArray(obj.aliases) ? obj.aliases : []),
        ...(Array.isArray(obj.alias) ? obj.alias : typeof obj.alias === "string" ? [obj.alias] : []),
    ];
    infoComs.aliases = [...new Set(aliasValues
        .filter((alias) => typeof alias === "string")
        .map((alias) => alias.trim().toLowerCase())
        .filter(Boolean))];
    infoComs.function = functions;
    
    const stack = new Error().stack;
    const filePath = stack.split('\n')[2].match(/\((.*):\d+:\d+\)/)[1];
    infoComs.filename = filePath;
    
    commands.push(infoComs);
    return infoComs;
}

module.exports = { gmd, commands, evt };

evt.commands = commands;  // this was hell and it took me 3 hours to fix since bot wasn't responding to commands after i had changed more bot structure logic

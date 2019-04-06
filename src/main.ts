import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const exists = promisify(fs.exists);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);

const BASE_DIR = path.join(os.homedir(), "Documents\\My Games\\Tabletop Simulator\\Saves");

interface SaveFileInfo {
    Directory: string;
    Name: string;
}

interface Save {
    SaveName: string;
    XmlUI?: string;
    LuaScript?: string;
    LuaScriptState?: string;
    ObjectStates: ObjectState[];
}

interface ObjectState {
    Name: string;
    GUID: string;
    XmlUI?: string;
    LuaScript?: string;
    LuaScriptState?: string;
    ContainedObjects?: ObjectState[];
}

interface HasScripts {
    Name?: string;
    GUID?: string;
    SaveName?: string;
    XmlUI?: string;
    LuaScript?: string;
    ContainedObjects?: ObjectState[];
    ObjectStates?: ObjectState[];
}

(async function() {
    if (process.argv.length !== 4) {
        const scriptName = path.basename(process.argv[1]);
        console.error(
            `Invalid arguments for ${scriptName}:\n` +
            `$ ${scriptName} extract|pack <save-name>`
        );
        process.exit(1);
    }
      
    const [, scriptName, mode, saveName] = process.argv;

    const saveFilePath = path.join(BASE_DIR, `${saveName}.json`);
    const json = await readFile(saveFilePath, {encoding: 'utf8'});
    const save = JSON.parse(json) as Save;
    const targetDir = path.join(BASE_DIR, saveName);

    if (mode === 'extract') {
        if (!await exists(targetDir)) {
            await mkdir(targetDir, {recursive: true});
        }
        await extractObject(targetDir, save);
    } else if (mode === 'pack') {
        await packObject(targetDir, save);
        await writeFile(saveFilePath, JSON.stringify(save, null, 2), {encoding: 'utf8'});
    } else {
        console.error(`Invalid mode for ${scriptName}: "${mode}"`);
        process.exit(2);
    }
})();

async function packObject(sourceDir: string, to: HasScripts) {
    const objectPath = getObjectPath(sourceDir, to);

    if (await exists(`${objectPath}.lua`)) {
        const lua = await readFile(`${objectPath}.lua`, {encoding: 'utf8'});
        to.LuaScript = lua;
    }
    
    if (await exists(`${objectPath}.xml`)) {
        to.XmlUI = await readFile(`${objectPath}.xml`, {encoding: 'utf-8'});
    }
    
    const children = to.ObjectStates || to.ContainedObjects;
    if (children) {
        for (const child of children) {
            packObject(sourceDir, child);
        }
    }
}

async function extractObject(targetDir: string, from: HasScripts) {
    const objectPath = getObjectPath(targetDir, from);

    if (typeof from.LuaScript === 'string') {
        await writeFile(`${objectPath}.lua`, from.LuaScript, {encoding: 'utf8'});
    }

    if (typeof from.XmlUI === 'string') {
        await writeFile(`${objectPath}.xml`, from.XmlUI, {encoding: 'utf8'});
    }

    const children = from.ObjectStates || from.ContainedObjects;
    if (children) {
        for (const child of children) {
            await extractObject(targetDir, child);
        }
    }
}

function getObjectPath(baseDir: string, obj: HasScripts): string {
    if (obj.SaveName) {
        return path.join(baseDir, `global`);
    } else {
        return path.join(baseDir, `${obj.Name}.${obj.GUID}`);
    }
}

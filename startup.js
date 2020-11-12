#!/usr/bin/env node
const {appendFileSync, writeFileSync} = require('fs')
const http = require('http')
const {execSync} = require('child_process')
const {hostname} = require('os')
const {basename, join} = require('path')
const homePath = join('/home', 'node'); // path of the node user home directory
const applicationPath = join('/home', 'node', 'app'); // path of the node user home directory

/**
 * Drop and create app directory
 */
function removeAppFolder() {
    try {
        execSync(`rm -R -f ${applicationPath}`,{cwd: homePath})
    } catch (error) {} // swallow error
    try {
        execSync(`mkdir -p ${applicationPath}`,{cwd: homePath})
    } catch (error) {}
}

/** 
 * get the instance metadata with http call on GCP APIs
 */
function getInstanceMetadata(uri) {
    console.log(`get instance metadata...`);
    var options = {
        'method': 'GET',
        'hostname': 'metadata.google.internal',
        'path': `/computeMetadata/v1/instance${uri}`,
        'headers': {
            'Metadata-Flavor': 'Google'
        },
        'maxRedirects': 20
    };
    return new Promise((resolve,reject) => {
        var req = http.request(options, function (res) {
            var chunks = [];
            res.on("data", function (chunk) {
                chunks.push(chunk);
            });
    
            res.on("end", function (chunk) {
                let body = Buffer.concat(chunks);
                body = body.toString()
                try {
                    body = JSON.parse(body)
                } catch (error) {}
                resolve(body)
            });
    
            res.on("error", function (error) {
                reject(error)
            });
        });
        req.end();
    })
}

/** clone the repository in /home/node/app
 * @param  {} metadata
 */
function cloneRepository(metadata) {
    const gitUrl = metadata['GIT_URL']
    let gitBranch = metadata['GIT_BRANCH']
    if(!!gitUrl === false) {
        throw new Error('GIT_URL required')
    }
    if(!!gitBranch === false) { // default branch is master
        gitBranch = "master"
    }
    console.log(`clone repository ${gitUrl} on branch ${gitBranch} at ${applicationPath}`);
    const command = `git clone --single-branch --branch ${gitBranch} ${gitUrl} ${applicationPath}`
    execSync(command,{cwd: homePath, stdio: 'inherit'})
}

/**
 * npm install step
 */
function npmInstall(metadata) {
    console.log(`install npm dependencies...`);
    const cwd = join(applicationPath, metadata['APP_ROOT'] || '');
    console.log(`run npm install in ${cwd} folder`)
    execSync(`npm install`,{cwd, stdio: 'inherit'})
}

/**
 * npm start step
 */
function npmStart(metadata) {
    console.log(`start npm application...`);
    const cwd = join(applicationPath, metadata['APP_ROOT'] || '');
    console.log(`run npm start in ${cwd} folder`)
    execSync(`npm start`,{cwd, stdio: 'inherit'})
}

/**
 * Start the stackdriver service if present
 */
function startStackdriverAgent(activate = false) {
    console.log(`start stackdriver agent...`);
    try {
        if(activate === true) {
            execSync(`service stackdriver-agent start`,{cwd, stdio: 'inherit'})
        }
    } catch (error) {
        console.log(`stackdriver agent not installed, skip`);
    }
}

/**
 * autodestroy VM if metadata AUTODESTROY=true
 */
function autodestroyVirtualMachine(metadata) {
    const autodestroy = String(metadata['AUTODESTROY'])
    if(autodestroy === "true") {
        console.log(`Killing the Virtual Machine...`);
        const zone = metadata['ZONE']
        const name = metadata['NAME']
        const command = `gcloud compute instances delete ${name} --zone "${zone}" -q`
        execSync(command,{cwd: homePath, stdio: 'inherit'})
    }
}

/** 
 * write env file in /home/node/app
 * @param  {} metadata
 */
function writeEnvFile(metadata) {
    const ignoreKeys= ['GIT_URL', 'ZONE', 'NAME']
    const envFilePath = join(applicationPath, metadata['APP_ROOT'] || '','.env');
    console.log(`write env file at ${envFilePath} ...`);
    writeFileSync(envFilePath, '')
    const keys = Object.keys(metadata)
    keys.forEach(key => {
        if(!ignoreKeys.includes(key)) { // ignore some keys
            const value = metadata[key]
            appendFileSync(envFilePath,`${key}=${value}\n`)
        }
    });
}

/**
 * fetch metadatas from GCP Apis and return an object containing all usefull datas
 */
async function getVirtualMachineMetaData() {
    const attributes = await getInstanceMetadata('/attributes/?recursive=true&alt=json'); // get personnal METADATA
    const zone = await getInstanceMetadata('/zone');
    const name = await getInstanceMetadata('/name');
    attributes["ZONE"] = basename(zone)
    attributes["NAME"] = name
    return attributes
}


/** Install project and dependencies in the file system
 * @param  {} metadata
 */
function installProject(metadata) {
    removeAppFolder()
    cloneRepository(metadata)
    writeEnvFile(metadata)
    npmInstall(metadata)
}

/** run the nodejs application
 * @param  {} metadata
 */
function runProject(metadata) {
    npmStart(metadata)
}

/** actions to perform when the npm start is done
 * @param  {} metadata
 */
function postScriptActions(metadata) {
    autodestroyVirtualMachine(metadata)
}


/** 
 * main script, entrypoint of the script
 */
async function main() {
    startStackdriverAgent(false)
    const metadata = await getVirtualMachineMetaData() // collect metadata
    installProject(metadata) // install project and dependencies
    runProject(metadata) // run the app / script
    postScriptActions(metadata) // clean up if required
}

main()
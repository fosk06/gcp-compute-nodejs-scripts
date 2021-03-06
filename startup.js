#!/usr/bin/env node
const {appendFileSync, writeFileSync, readdirSync} = require('fs')
const http = require('http')
const {execSync} = require('child_process')
const {hostname} = require('os')
const {basename, join} = require('path')
const homePath = join('/home', 'node'); // path of the node user home directory
const applicationPath = join('/home', 'node', 'app'); // path of the node user home directory

/**
 * Drop and create app directory = /home/node/app
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
 * Drop and create app directory = /home/node/app
 */
function checkFileSystem() {
    try {
        readdirSync(applicationPath)
    } catch (error) {
        throw new Error('/home/node/app folder does not exist')
    }
}

/** 
 * get the instance metadata with http call on GCP APIs
 * @param  {} uri the metadata uri to call on the metadata server, example /attributes/...
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

/** clone the repository in /home/node/app, use the metadata GIT_URL for the git url and GIT_BRANCH for branch
 * @param  {} metadata
 */
function cloneRepository(metadata) {
    const gitUrl = metadata['GIT_URL']
    let gitBranch = metadata['GIT_BRANCH']
    if(!!gitUrl === false) {
        throw new Error('GIT_URL required')
    }
    if(!!gitBranch === false) { // default branch is main
        gitBranch = "main"
    }
    console.log(`clone repository ${gitUrl} on branch ${gitBranch} at ${applicationPath}`);
    const command = `git clone --single-branch --branch ${gitBranch} ${gitUrl} ${applicationPath}`
    execSync(command,{cwd: homePath, stdio: 'inherit'})
}

/**
 * npm install step, APP_ROOT metadata allow yout to change the default path of the application
 */
function npmInstall(metadata) {
    console.log(`install npm dependencies...`);
    const cwd = join(applicationPath, metadata['APP_ROOT'] || '');
    console.log(`run npm install in ${cwd} folder`)
    execSync(`npm install`,{cwd, stdio: 'inherit'})
}

/**
 * npm start step, skip if metadata SKIP_START = false
 */
function npmStart(metadata) {
    if(metadata['SKIP_START'] && metadata['SKIP_START'] === "true") {
        console.log(`skip npm start...`)
        return metadata
    }
    console.log(`start npm application...`);
    const cwd = join(applicationPath, metadata['APP_ROOT'] || '');
    console.log(`run npm start in ${cwd} folder`)
    execSync(`npm start`,{cwd, stdio: 'inherit'})
}

/**
 * npm build step, using APP_ROOT metadata if specified
 */
function npmBuild(metadata) {
    console.log(`build nodejs application...`);
    const cwd = join(applicationPath, metadata['APP_ROOT'] || '');
    console.log(`run npm run build in ${cwd} folder`)
    execSync(`npm run build --if-present`,{cwd, stdio: 'inherit'})
}

/**
 * Start the stackdriver service if metadata STACKDRIVER_AGENT=true
 */
function startStackdriverAgent(metadata) {
    const activate = String(metadata['STACKDRIVER_AGENT'])
    console.log(`start stackdriver agent...`);
    try {
        if(activate === "true") {
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
 * write env file in /home/node/app, use APP_ROOT if specified ignore few deployment metadatas 
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

/** build if necessary the nodejs application
 * @param  {} metadata
 */
function buildProject(metadata) {
    npmBuild(metadata)
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
    checkFileSystem() // test if the file system is ready for this script
    const metadata = await getVirtualMachineMetaData() // collect metadata
    startStackdriverAgent(metadata) // start the stackdriver agent if necessary
    installProject(metadata) // install project and dependencies
    buildProject(metadata) // build the app / script
    runProject(metadata) // run the app / script
    postScriptActions(metadata) // clean up if required
}

main()
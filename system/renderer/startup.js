const fs = require('fs-extra');
const { spawn, spawnSync } = require('child_process');
const { getCMSConfigSync, rendererMessages } = require('@cromwell/core-backend');
const { projectRootDir, buildDir, tempDir, rendererRootDir } = require('./constants');
const { resolve } = require('path');

/**
 * 'buildService' - compile "src" files into "build" dir
 * 'dev' - Next.js "dev" command. Will check if service is built
 * 'build' - Next.js "build" command. Will check if service is built
 * 'buildStart' - Run Next.js "build" command and then "start". Will check if service is built
 * 'prod' - Next.js "start" command. Will check if service is built and if Next.js has build
 */
const scriptName = process.argv[2];


const main = async () => {
    let config = getCMSConfigSync(projectRootDir);
    if (!config) throw new Error('renderer::server cannot read CMS config');

    const isServiceBuilt = () => {
        return (fs.existsSync(buildDir)
            && fs.existsSync(resolve(buildDir, 'renderer.js'))
            && fs.existsSync(resolve(buildDir, 'generator.js')))
    }

    const buildService = () => {
        spawnSync(`npx rollup -c`, [],
            { shell: true, stdio: 'inherit', cwd: rendererRootDir });
    }

    const isFrontendBuilt = () => {
        return (fs.existsSync(`${tempDir}/.next/static`)
            && fs.existsSync(`${tempDir}/.next/BUILD_ID`)
            && fs.existsSync(`${tempDir}/.next/build-manifest.json`)
            && fs.existsSync(`${tempDir}/.next/prerender-manifest.json`)
        )
    }

    const gen = () => {
        spawnSync(`node ./generator.js`, [],
            { shell: true, stdio: 'inherit', cwd: buildDir });
    }

    const build = async () => {
        if (process.send) process.send(rendererMessages.onBuildStartMessage);
        try {
            if (!isServiceBuilt()) {
                buildService();
            }
            gen();
            await new Promise(res => {
                const proc = spawn(`npx next build`, [],
                    { shell: true, stdio: 'pipe', cwd: tempDir });

                if (proc.stderr && proc.stderr.on && proc.stderr.once) {
                    proc.stderr.on('data', (data) => {
                        console.log(data.toString ? data.toString() : data);
                    });
                    proc.stderr.once('data', (data) => {
                        if (process.send) process.send(rendererMessages.onBuildErrorMessage);
                    });
                }
                if (proc.stdout && proc.stdout.on) {
                    proc.stdout.on('data', (data) => {
                        console.log(data.toString ? data.toString() : data);
                    });
                }

                proc.on('close', () => {
                    res();
                })
            })

        } catch (e) {
            console.log(e);
        }
        if (process.send) process.send(rendererMessages.onBuildEndMessage);
    }

    const start = async () => {
        let proc;
        try {
            if (!isFrontendBuilt()) {
                await build();
            }

            proc = spawn(`npx next start -p ${config.frontendPort}`, [],
                { shell: true, stdio: 'pipe', cwd: tempDir });
        } catch (e) {
            if (process.send) process.send(rendererMessages.onStartErrorMessage);
            console.log(e);
        }

        // @TODO: Make it somehow accept Next.js server on ready event. Just a timeout for now...
        if (proc && proc.stdout) proc.stdout.once('data', (data) => {
            setTimeout(() => {
                console.log(data.toString ? data.toString() : data);
                if (process.send) process.send(rendererMessages.onStartMessage);
            }, 100);
        });

        if (proc && proc.stderr) proc.stderr.once('data', (data) => {
            console.log(data.toString ? data.toString() : data);
            if (process.send) process.send(rendererMessages.onStartErrorMessage);
        });

    }


    if (scriptName === 'buildService') {
        buildService();
        return;
    }

    if (scriptName === 'dev') {
        if (!isServiceBuilt()) {
            buildService();
        }
        gen();

        spawn(`npx rollup -cw`, [],
            { shell: true, stdio: 'inherit', cwd: rendererRootDir });

        spawn(`npx next dev -p ${config.frontendPort}`, [],
            { shell: true, stdio: 'inherit', cwd: tempDir });

        return;
    }

    if (scriptName === 'build') {
        build();
        return;
    }

    if (scriptName === 'prod') {
        start();
        return;
    }

    if (scriptName === 'buildStart') {
        await build();
        start();
        return;
    }




}

main();
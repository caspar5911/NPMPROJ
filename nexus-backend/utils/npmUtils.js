const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');
//const os = require('os');
const semver = require('semver');
require('dotenv').config();

const TEMP_DIR = path.resolve(__dirname, '..', 'pkg_temp');
const PACKAGES_DIR = path.join(TEMP_DIR, 'packages_new');
const OLD_PACKAGES_DIR = path.join(TEMP_DIR, 'packages_old');

const { NEXUS_USERNAME, NEXUS_PASSWORD, NEXUS_EMAIL } = process.env;

function ensurePackagesFolder() {
    if (!fs.existsSync(PACKAGES_DIR)) fs.mkdirSync(PACKAGES_DIR, { recursive: true });
    return PACKAGES_DIR;
}

function ensureOldPackagesFolder() {
    if (!fs.existsSync(OLD_PACKAGES_DIR)) fs.mkdirSync(OLD_PACKAGES_DIR, { recursive: true });
    return OLD_PACKAGES_DIR;
}

function moveAllFiles(srcDir, destDir) {
    // Ensure destination exists
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        const oldPath = path.join(srcDir, file);
        const newPath = path.join(destDir, file);
        fs.renameSync(oldPath, newPath); // moves the file
    }
}

function createNpmrc(registryUrl) {
    const registry = new URL(registryUrl);
    const registryHostPath = `${registry.host}${registry.pathname.replace(/\/$/, '')}`;
    const encodedPassword = Buffer.from(NEXUS_PASSWORD).toString('base64');

    const npmrcContent = [
        `registry=${registryUrl}`,
        `always-auth=true`,
        `//${registryHostPath}/:username=${NEXUS_USERNAME}`,
        `//${registryHostPath}/:_password=${encodedPassword}`,
        `//${registryHostPath}/:email=${NEXUS_EMAIL}`,
        `strict-ssl=false`
    ].join('\n');

    const npmrcPath = path.join(PACKAGES_DIR, '.npmrc');
    fs.writeFileSync(npmrcPath, npmrcContent);
    return npmrcPath;
}

function deleteNpmrc() {
    const npmrcPath = path.join(PACKAGES_DIR, '.npmrc');
    if (fs.existsSync(npmrcPath)) fs.unlinkSync(npmrcPath);
}

function downloadTarball(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`Failed to download ${url}`));
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', reject);
    });
}

async function downloadDependenciesTarballs(packageSpec, targetDir, visited = new Set()) {
    let pkgName, requestedVersion;

    // Parse package name and version
    if (packageSpec.startsWith('@')) {
        const atIndex = packageSpec.lastIndexOf('@');
        if (atIndex > 0) {
            pkgName = packageSpec.slice(0, atIndex);
            requestedVersion = packageSpec.slice(atIndex + 1);
        } else {
            pkgName = packageSpec;
            requestedVersion = 'latest';
        }
    } else {
        [pkgName, requestedVersion = 'latest'] = packageSpec.split('@');
    }

    // Handle npm alias dependencies like "npm:string-width@^8.0.0"
    if (requestedVersion.startsWith('npm:')) {
        // Extract real package and version from alias
        const aliasSpec = requestedVersion.slice(4); // remove "npm:"
        console.log(`Resolving npm alias ${packageSpec} → ${aliasSpec}`);
        return downloadDependenciesTarballs(aliasSpec, targetDir, visited);
    }

    const key = `${pkgName}@${requestedVersion}`;
    if (visited.has(key)) return;
    visited.add(key);

    const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(pkgName)}`;
    const res = await fetch(registryUrl);
    if (!res.ok) throw new Error(`Failed to fetch ${pkgName} metadata from npm`);
    const data = await res.json();

    // Resolve version
    let version = requestedVersion === 'latest' ? data['dist-tags'].latest : requestedVersion;
    if (!data.versions[version]) {
        const maxSatisfying = semver.maxSatisfying(Object.keys(data.versions), version);
        if (!maxSatisfying) throw new Error(`Version ${version} not found for package ${pkgName}`);
        version = maxSatisfying;
    }

    const tarballUrl = data.versions[version].dist.tarball;
    const filename = path.basename(new URL(tarballUrl).pathname);
    const destPath = path.join(targetDir, filename);

    if (!fs.existsSync(destPath)) {
        console.log(`Downloading ${pkgName}@${version}...`);
        await downloadTarball(tarballUrl, destPath);
    }

    // Recursively download dependencies
    const dependencies = data.versions[version].dependencies || {};
    for (const [dep, depVersion] of Object.entries(dependencies)) {
        await downloadDependenciesTarballs(`${dep}@${depVersion}`, targetDir, visited);
    }

    return destPath;
}

async function npmPack(packageSpec) {
    const targetDir = ensurePackagesFolder();
    console.log(`Packing ${packageSpec} and all dependencies into ${targetDir}...`);
    const tarballs = [];
    await downloadDependenciesTarballs(packageSpec, targetDir); // automatically downloads dependencies
    return fs.readdirSync(targetDir)
        .filter(f => f.endsWith('.tgz'))
        .map(f => path.join(targetDir, f));
}

function npmPublishTarball(tarballPath, registryUrl) {
    return new Promise((resolve, reject) => {
        if (!NEXUS_USERNAME || !NEXUS_PASSWORD || !NEXUS_EMAIL) {
            return reject(new Error('Missing NEXUS_USERNAME, NEXUS_PASSWORD or NEXUS_EMAIL in .env'));
        }
        if (!fs.existsSync(tarballPath)) return reject(new Error(`Tarball not found: ${tarballPath}`));

        const npmrcPath = createNpmrc(registryUrl);
        const cmd = `npm publish "${tarballPath}" --registry=${registryUrl} --userconfig="${npmrcPath}" --no-provenance --tag old`;
        exec(cmd, (err, stdout, stderr) => {
            deleteNpmrc();
            if (err) return reject(stderr || err.message);
            resolve(stdout.trim());
        });
    });
}

async function publishAllTarballs(registryUrl, retries = 3) {
    const folder = ensurePackagesFolder();
    const tarballs = fs.readdirSync(folder)
        .filter(f => f.endsWith('.tgz'))
        .map(f => path.join(folder, f));

    if (tarballs.length === 0) throw new Error('No .tgz tarballs found to publish.');

    const publishWithRetry = async (tarball, attempt = 1) => {
        try {
            const output = await npmPublishTarball(tarball, registryUrl);
            return { tarball: path.basename(tarball), status: 'success', output };
        } catch (err) {
            if (attempt < retries) {
                console.log(`Retrying ${path.basename(tarball)} (attempt ${attempt + 1})...`);
                return publishWithRetry(tarball, attempt + 1);
            }
            const msg = (err.message || err.toString());
            return { tarball: path.basename(tarball), status: 'error', error: msg };
        }
    };

    const publishPromises = tarballs.map(tarball => publishWithRetry(tarball));
    return Promise.all(publishPromises);
}

function listTarballs() {
    const folder = ensurePackagesFolder();
    return fs.readdirSync(folder)
        .filter(f => f.endsWith('.tgz'))
        .map(f => path.join(folder, f));
}

module.exports = {
    npmPack,
    npmPublishTarball,
    publishAllTarballs,
    listTarballs,
    ensureOldPackagesFolder,
    ensurePackagesFolder,
    moveAllFiles
};

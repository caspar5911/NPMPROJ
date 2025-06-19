const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const PACKAGES_DIR = path.resolve(__dirname, '..', 'packages');
const { NEXUS_USERNAME, NEXUS_PASSWORD, NEXUS_EMAIL } = process.env;

function ensurePackagesFolder() {
  if (!fs.existsSync(PACKAGES_DIR)) {
    fs.mkdirSync(PACKAGES_DIR, { recursive: true });
  }
  return PACKAGES_DIR;
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
  if (fs.existsSync(npmrcPath)) {
    fs.unlinkSync(npmrcPath);
  }
}

function npmPack(packageSpec, registryUrl) {
  console.log(`Packing package: ${packageSpec} for registry: ${registryUrl}`);
  return new Promise((resolve, reject) => {
    const cwd = ensurePackagesFolder();
    const cmd = `npm pack ${packageSpec} --registry=${registryUrl}`;

    exec(cmd, { cwd }, (err, stdout, stderr) => {
      if (err) return reject(stderr || err.message);
      const filename = stdout.trim().split('\n').pop();
      resolve(path.join(cwd, filename));
    });
  });
}

function npmPublishTarball(tarballPath, registryUrl) {
  return new Promise((resolve, reject) => {
    if (!NEXUS_USERNAME || !NEXUS_PASSWORD || !NEXUS_EMAIL) {
      return reject(new Error('Missing NEXUS_USERNAME, NEXUS_PASSWORD or NEXUS_EMAIL in .env'));
    }

    if (!fs.existsSync(tarballPath)) {
      return reject(new Error(`Tarball not found at path: ${tarballPath}`));
    }

    const npmrcPath = createNpmrc(registryUrl);
    const normalizedTarballPath = path.normalize(tarballPath);
    const cmd = `npm publish "${normalizedTarballPath}" --registry=${registryUrl} --userconfig="${npmrcPath}" --no-provenance --tag old`;

    exec(cmd, (err, stdout, stderr) => {
      deleteNpmrc(); // cleanup
      if (err) return reject(stderr || err.message);
      resolve(stdout.trim());
    });
  });
}

function publishAllTarballs(registryUrl) {
  const folder = ensurePackagesFolder();
  const allFiles = fs.readdirSync(folder);
  const tarballs = allFiles.filter(f => f.endsWith('.tgz')).map(f => path.join(folder, f));

  if (tarballs.length === 0) {
    throw new Error('No .tgz tarballs found to publish.');
  }

  const results = [];

  return new Promise(async (resolve) => {
    for (const tarballPath of tarballs) {
      try {
        const output = await npmPublishTarball(tarballPath, registryUrl);
        results.push({ tarball: path.basename(tarballPath), status: 'success', output });
      } catch (err) {
        const errStr = (typeof err === 'string') ? err : (err.message || err.toString());
        if (errStr.includes('You cannot publish over the previously published versions')) {
          results.push({
            tarball: path.basename(tarballPath),
            status: 'error',
            error: 'This version already exists in the registry.',
          });
          continue;
        }
        results.push({
          tarball: path.basename(tarballPath),
          status: 'error',
          error: errStr || 'Unknown error',
        });
      }
    }

    resolve(results);
  });
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
};

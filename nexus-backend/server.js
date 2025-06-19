require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const {
  npmPack,
  npmPublishTarball,
  publishAllTarballs,
  listTarballs
} = require('./utils/npmUtils');

const {
  nugetPack,
  nugetPush,
  listNuPkgs
} = require('./utils/nugetUtils');

const upload = multer({ dest: 'uploads/' });
const app = express();
const router = express.Router();

app.use(cors());
app.use(express.json());

//-----------------------------------NPM Package Management------------------------------------
app.post('/api/publish-all', async (req, res) => {
  const { registryUrl } = req.body;
  if (!registryUrl) return res.status(400).json({ error: 'registryUrl is required' });

  try {
    const results = await publishAllTarballs(registryUrl);
    res.json({ message: 'Publish all completed.', results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/list-tarballs', (req, res) => {
  try {
    const tarballs = listTarballs();
    res.json({ tarballs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read tarballs folder' });
  }
});

app.post('/api/pack', async (req, res) => {
  const { packageName, version, registryUrls } = req.body;
  if (!packageName) return res.status(400).json({ error: 'Package name is required' });
  if (!registryUrls || registryUrls.length === 0) return res.status(400).json({ error: 'Registry Url is required' });

  const spec = version ? `${packageName}@${version}` : packageName;
  let count = 0;

  for (const registry of registryUrls) {
    try {
      const tarballPath = await npmPack(spec, registry);
      res.json({ message: 'Pack successful', tarballPath });
      return;
    } catch (err) {
      if (++count === registryUrls.length) {
        return res.status(500).json({ error: err.message || 'Unknown error' });
      }
    }
  }
});

app.post('/api/publish', async (req, res) => {
  const { tarballPath, registryUrl } = req.body;
  if (!tarballPath || !registryUrl) {
    return res.status(400).json({ error: 'tarballPath and registryUrl are required' });
  }

  try {
    const output = await npmPublishTarball(tarballPath, registryUrl);
    res.json({ message: 'Publish successful', output });
  } catch (err) {
    const msg = err.message || err.toString();
    if (msg.includes('You cannot publish over the previously published versions')) {
      return res.status(409).json({ error: 'This version already exists in the registry.' });
    }
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
});

router.post('/api/pack-from-packagejson', upload.single('packageJson'), async (req, res) => {
  const packageJson = req.file;
  if (!packageJson) return res.status(400).json({ error: 'No file uploaded' });

  let parsedJson;
  try {
    const content = fs.readFileSync(packageJson.path, 'utf-8');
    parsedJson = JSON.parse(content);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid JSON file uploaded' });
  } finally {
    fs.unlinkSync(packageJson.path);
  }

  const dependencies = {
    ...(parsedJson.dependencies || {}),
    ...(parsedJson.devDependencies || {}),
  };

  const registryUrls = req.body.registryUrls ? JSON.parse(req.body.registryUrls) : [];
  if (registryUrls.length === 0) {
    return res.status(400).json({ error: 'Registry Url is required' });
  }

  const results = [];

  for (const [pkg, version] of Object.entries(dependencies)) {
    const spec = typeof version === 'string' && version.startsWith('file:') ? pkg : `${pkg}@${version}`;
    let lastErr = "";
    let success = false;

    for (const registry of registryUrls) {
      try {
        const tarballPath = await npmPack(spec, registry);
        results.push({ package: pkg, version, status: 'success', tarballPath });
        success = true;
        break;
      } catch (err) {
        lastErr = err;
        continue;
      }
    }

    if (!success) {
      results.push({ package: pkg, version, status: 'error', error: lastErr.toString() });
    }
  }

  res.json({ results });
});

app.use(router);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
//-----------------------------------NPM Package Management------------------------------------


//----------------------------------Nuget Package Management-----------------------------------
app.post('/api/nuget/pack', async (req, res) => {
  const { csprojPath } = req.body;
  if (!csprojPath) return res.status(400).json({ error: 'csprojPath is required' });

  try {
    const nupkgPath = await nugetPack(csprojPath);
    res.json({ message: 'NuGet pack successful', nupkgPath });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to pack NuGet' });
  }
});

app.post('/api/nuget/push', async (req, res) => {
  const { nupkgPath, registryUrl, apiKey } = req.body;
  if (!nupkgPath || !registryUrl || !apiKey) {
    return res.status(400).json({ error: 'nupkgPath, registryUrl and apiKey are required' });
  }

  try {
    const output = await nugetPush(nupkgPath, registryUrl, apiKey);
    res.json({ message: 'NuGet push successful', output });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to push NuGet package' });
  }
});

//----------------------------------Nuget Package Management-----------------------------------
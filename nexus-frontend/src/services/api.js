// src/api.js
//----------------------------------NPM Package Management API-----------------------------------
export async function fetchPackageVersions(packageName) {
  if (!packageName) throw new Error('Package name is required');

  const res = await fetch(`https://registry.npmjs.org/${packageName}`);
  if (!res.ok) {
    throw new Error('Package not found on NPM');
  }
  const data = await res.json();
  return Object.keys(data.versions).reverse();
}

export async function packNpmPackage(packageName, version, registryUrls) {
  if (!packageName || !version) throw new Error('Package name and version are required');

  const res = await fetch('http://localhost:4000/api/pack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageName, version, registryUrls }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Error packing package');
  }

  return data.tarballPath;
}

export async function fetchAllTarballs() {
  const res = await fetch('http://localhost:4000/api/list-tarballs');
  if (!res.ok) throw new Error('Failed to fetch tarballs');
  const data = await res.json();
  return data.tarballs || [];
}

export async function publishTarball(tarballPath, registryUrl) {
  const res = await fetch('http://localhost:4000/api/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tarballPath, registryUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Publish failed');
  return data.output;
}

export async function publishAllTarballs(registryUrl) {
  const res = await fetch('http://localhost:4000/api/publish-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registryUrl }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Publish all failed');
  return data.results;
}

// api.js

export async function uploadPackageJson(file, registryUrls) {
  const formData = new FormData();
  formData.append('packageJson', file);
  formData.append('registryUrls', JSON.stringify(registryUrls));

  const res = await fetch('http://localhost:4000/api/pack-from-packagejson', {
    method: 'POST',
    body: formData,
  });

  const text = await res.text();

  if (!res.ok) {
    let errorMsg = text;
    try {
      const data = JSON.parse(text);
      errorMsg = data.error || text;
    } catch {}
    throw new Error(errorMsg);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Server returned non-JSON response');
  }
}

//----------------------------------NPM Package Management API-----------------------------------
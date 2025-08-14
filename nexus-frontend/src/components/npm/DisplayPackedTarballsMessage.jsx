export default function DisplayPackedTarballsMessage({ packedTarballs }) {
  if (packedTarballs.length === 0) {
    return (
      <div style={{ fontWeight: 'bold', whiteSpace: 'pre-wrap', minHeight: '1.5em' }}>
        No tarballs packed yet. Use the form above to generate and pack tarballs.
      </div>
    );
  }

  return (
    <div style={{ fontWeight: 'bold', whiteSpace: 'pre-wrap', minHeight: '1.5em' }}>
      {packedTarballs.length} tarball(s) packed:
      <ul>
        {packedTarballs.map((path, index) => (
          <li key={index}>{path}</li>
        ))}
      </ul>
    </div>
  );
}
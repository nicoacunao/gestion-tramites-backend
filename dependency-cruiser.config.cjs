/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'module-internals-are-private',
      severity: 'error',
      comment: 'Otros módulos solo pueden importar el index público.',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/([^/]+)/(?!index\\.ts$)',
        pathNot: '^src/modules/$1/',
      },
    },
    {
      name: 'domain-does-not-depend-on-outer-layers',
      severity: 'error',
      from: { path: '/domain/' },
      to: { path: '/(http|infrastructure)/' },
    },
    {
      name: 'http-does-not-import-infrastructure',
      severity: 'error',
      from: { path: '/http/' },
      to: { path: '/infrastructure/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: { exportsFields: ['exports'] },
  },
};

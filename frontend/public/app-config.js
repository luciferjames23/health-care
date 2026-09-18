window.config = {
  routerBasename: '/',
  extensions: [],
  modes: [],
  showStudyList: true,

  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',

      configuration: {
        friendlyName: 'Meridian Orthanc Demo PACS',
        name: 'orthanc',

        // Same-origin through the nginx gateway on localhost:3000.
        // The gateway injects Orthanc's demo Basic Auth credentials.
        wadoUriRoot: '/wado',
        qidoRoot: '/dicom-web',
        wadoRoot: '/dicom-web',

        qidoSupportsIncludeField: false,
        supportsReject: false,
        imageRendering: 'wadors',
        thumbnailRendering: 'wadors',
        enableStudyLazyLoad: true,
        supportsFuzzyMatching: false,
        supportsWildcard: true,

        // IMPORTANT: Orthanc is a live DICOMweb server, not a Static-WADO
        // filesystem.  staticWado: true breaks frame retrieval with Orthanc.
        staticWado: false,

        // Allow OHIF to retrieve bulk data via DICOMweb BulkData endpoint.
        bulkDataURI: {
          enabled: true,
          relativeResolution: 'series',
        },
      },
    },
  ],

  defaultDataSourceName: 'dicomweb',
};

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

        staticWado: true,
        singlepart: 'bulkdata,video,pdf',

        omitQuotationForMultipartRequest: true,
      },
    },
  ],

  defaultDataSourceName: 'dicomweb',
};
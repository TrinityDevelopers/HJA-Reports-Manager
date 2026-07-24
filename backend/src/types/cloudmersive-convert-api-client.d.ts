declare module 'cloudmersive-convert-api-client' {
  type ConvertCallback = (error: Error | null, data?: unknown, response?: unknown) => void;

  interface ApiClientInstance {
    authentications: {
      Apikey: { apiKey: string };
    };
  }

  interface ApiClientStatic {
    instance: ApiClientInstance;
  }

  interface ConvertDocumentApi {
    convertDocumentXlsxToPdf(inputFile: Buffer, callback: ConvertCallback): void;
  }

  interface ConvertDocumentApiConstructor {
    new (): ConvertDocumentApi;
  }

  const CloudmersiveConvertApiClient: {
    ApiClient: ApiClientStatic;
    ConvertDocumentApi: ConvertDocumentApiConstructor;
  };

  export = CloudmersiveConvertApiClient;
}

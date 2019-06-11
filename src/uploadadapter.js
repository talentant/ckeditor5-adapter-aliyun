import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import FileRepository from '@ckeditor/ckeditor5-upload/src/filerepository';

import qs from 'qs';
import axios from 'axios';

export default class AliyunUploadAdapter extends Plugin {
  /**
   * @inheritDoc
   */
  static get requires () {
    return [FileRepository];
  }

  /**
   * @inheritDoc
   */
  static get pluginName () {
    return 'AliyunUploadAdapter';
  }

  /**
   * @inheritDoc
   */
  init () {
    const baseConfig = this.editor.config.get('aliyun.baseConfig');

    if (typeof baseConfig !== "object") {
      return;
    }

    const mixedConfig = Object.assign({
      baseUrl: '',
      configUrl: '',
    }, baseConfig);

    this.editor.plugins.get(FileRepository).createUploadAdapter = (loader) => {
      return new UploadAdapter(loader, mixedConfig, this.editor.t)
    };
  }
}

class UploadAdapter {

  constructor (loader, mixedConfig, t) {
    this.loader = loader;
    this.mixedConfig = mixedConfig;
    this.t = t;
  }

  upload () {
    return this.loader.file.then(file => {
      return new Promise((resolve, reject) => {
        axios
          .create({
            baseURL: this.mixedConfig.baseUrl,
            timeout: 60000,
            withCredentials: true,
            paramsSerializer (params) {
              return qs.stringify(params, {arrayFormat: 'brackets'})
            },
          })
          .get(this.mixedConfig.configUrl, {params: {fileInfo: file}})
          .then((response) => {
            if (response.data.isOk) {
              const serverConfig = response.data.data;
              const serverUrl = serverConfig.dir + file.name;

              const formData = new FormData();
              formData.append('file', file);
              formData.append('name', 'file');
              formData.append('key', serverUrl);
              formData.append('OSSAccessKeyId', serverConfig.ak);
              formData.append('success_action_status', '200');
              formData.append('policy', serverConfig.policy);
              formData.append('signature', serverConfig.signature);

              this.xhr = new XMLHttpRequest();
              this.xhr.open('POST', serverConfig.host);

              const genericError = this.t('Cannot upload file:') + ` ${file.name}.`;
              this.xhr.addEventListener('error', () => reject(genericError));
              this.xhr.addEventListener('abort', () => reject());
              if (this.xhr.upload) {
                this.xhr.upload.addEventListener('progress', evt => {
                  if (evt.lengthComputable) {
                    this.loader.uploadTotal = evt.total;
                    this.loader.uploaded = evt.loaded;
                  }
                });
              }
              this.xhr.addEventListener('load', () => {
                const response = this.xhr.response;
                if (!response || !response.uploaded) {
                  return reject(response && response.error && response.error.message ? response.error.message : genericError);
                }
                resolve({default: serverConfig.host + '/' + serverUrl});
              });

              this.xhr.send(formData);
            }
          });
      });
    });
  }

  abort () {
    if (this.xhr) {
      this.xhr.abort();
    }
  }
}

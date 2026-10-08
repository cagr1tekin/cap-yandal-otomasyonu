// AppModule yapılandırmayı içe aktarılırken okur; bu yüzden ortam testten önce ayarlanır.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://cap:cap_dev@localhost:5442/cap_bm_test?schema=public';
process.env.REDIS_URL = 'redis://127.0.0.1:6389/1';
process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.OIDC_ISSUER = 'http://localhost:8088/realms/selcuk';
process.env.OIDC_AUDIENCE = 'cap-web';
process.env.UPLOAD_DIR = './storage-test';
process.env.WORKER_ENABLED = 'false';

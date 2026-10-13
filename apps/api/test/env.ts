// AppModule yapılandırmayı içe aktarılırken okur; bu yüzden ortam testten önce ayarlanır.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://cap:cap_dev@localhost:5442/cap_takip_test?schema=public';
process.env.REDIS_URL = 'redis://127.0.0.1:6389/1';
process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.UPLOAD_DIR = './storage-test';
process.env.WORKER_ENABLED = 'false';
process.env.AUTH_SECRET = 'test-icin-en-az-otuz-iki-karakterlik-anahtar';

const request = require('supertest');
const { expect } = require('chai');
const nock = require('nock');
const zlib = require('zlib');

const app = require('../examples/example');

const client = app.context.raven;

describe('koa2-raven', function() {
  it('should respond 200', function(done) {
    request(app.callback())
      .get('/')
      .expect(200, 'ok')
      .end((err) => {
        if (err) throw new Error(err);
        done();
      });
  });
  it('should capture exception', function(done) {
    const scope = nock('https://app.getsentry.com:443')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, 'OK');
    client.once('logged', () => {
      scope.done();
      done();
    });
    request(app.callback())
      .get('/throw')
      .expect(500, 'Internal Server Error')
      .end((err) => {
        if (err) throw new Error(err);
      });
  });
  it('should not capture 400 bad request ctx.throw', function(done) {
    const scope = nock('https://app.getsentry.com:443')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, 'OK');
    request(app.callback())
      .get('/normalThrow')
      .expect(400, 'Bad Request')
      .end(() => {
        setTimeout(() => {
          expect(scope.pendingMocks().length).to.eq(1);
          nock.cleanAll();
          done();
        }, 300);
      });
  });
  it('should not capture 401 unauthorized ctx.assert', function(done) {
    const scope = nock('https://app.getsentry.com:443')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, 'OK');
    request(app.callback())
      .get('/unauthThrow')
      .expect(401)
      .end(() => {
        setTimeout(() => {
          expect(scope.pendingMocks().length).to.eq(1);
          nock.cleanAll();
          done();
        }, 300);
      });
  });
  it('should capture body on exception', function(done) {
    const scope = nock('https://app.getsentry.com:443')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, 'OK');
    client.once('logged', () => {
      scope.done();
      done();
    });
    request(app.callback())
      .post('/throwPost')
      .send({ value: 1 })
      .expect(500, 'Internal Server Error')
      .end((err) => {
        if (err) throw new Error(err);
      });
  });
  it('should send an Error to Sentry server', function(done) {
    const scope = nock('https://public:private@app.getsentry.com')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, 'OK');

    client.once('logged', function() {
      scope.done();
      done();
    });
    client.captureException('wtf?');
  });
  it('should capture user', function (done) {
    const scope = nock('https://app.getsentry.com')
      .filteringRequestBody(/.*/, '*')
      .post('/api/269/store/', '*')
      .reply(200, function (uri, body) {
        zlib.inflate(Buffer.from(body, 'base64'), (err, dec) => {
          if (err) return done(err);
          const msg = JSON.parse(dec.toString());
          expect(msg.user).to.have.property('email').and.eq('matt@example.com');
          expect(msg.user).to.have.property('id').and.eq('123');

          return done();
        });
        return 'OK';
      });

    client.setContext({
      user: {
        email: 'matt@example.com',
        id: '123',
      },
    });

    client.once('logged', function () {
      scope.done();
    });
    request(app.callback())
      .get('/throwUser')
      .expect(500, 'Internal Server Error')
      .end((err) => {
        if (err) throw new Error(err);
      });
  });
});

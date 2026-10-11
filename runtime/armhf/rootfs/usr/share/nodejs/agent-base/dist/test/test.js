"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const net_1 = __importDefault(require("net"));
const tls_1 = __importDefault(require("tls"));
const url_1 = __importDefault(require("url"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const assert_1 = __importDefault(require("assert"));
const async_listen_1 = __importDefault(require("async-listen"));
const semver_1 = require("semver");
const src_1 = require("../src");
// In Node 12+ you can just override `http.globalAgent`, but for older Node
// versions we have to patch the internal `_http_agent` module instead
// (see: https://github.com/nodejs/node/pull/25170).
// @ts-ignore
const _http_agent_1 = __importDefault(require("_http_agent"));
const sleep = (n) => new Promise(r => setTimeout(r, n));
const req = (opts) => {
    return new Promise((resolve, reject) => {
        (opts.protocol === 'https:' ? https_1.default : http_1.default)
            .request(opts, resolve)
            .once('error', reject)
            .end();
    });
};
const sslOptions = {
    key: fs_1.default.readFileSync('test/ssl-cert-snakeoil.key'),
    cert: fs_1.default.readFileSync('test/ssl-cert-snakeoil.pem')
};
function json(res) {
    return new Promise((resolve, reject) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', b => {
            data += b;
        });
        res.on('end', () => resolve(JSON.parse(data)));
    });
}
describe('Agent (TypeScript)', () => {
    describe('subclass', () => {
        it('should be extendable (direct return)', () => {
            class MyAgent extends src_1.Agent {
                callback(req, opts) {
                    return http_1.default.globalAgent;
                }
            }
            const agent = new MyAgent();
            (0, assert_1.default)(agent instanceof src_1.Agent);
            (0, assert_1.default)(agent instanceof MyAgent);
        });
        it('should be extendable (promise return)', () => {
            class MyAgent extends src_1.Agent {
                callback(req, opts) {
                    return __awaiter(this, void 0, void 0, function* () {
                        return Promise.resolve(http_1.default.globalAgent);
                    });
                }
            }
            const agent = new MyAgent();
            (0, assert_1.default)(agent instanceof src_1.Agent);
            (0, assert_1.default)(agent instanceof MyAgent);
        });
    });
    describe('"http" module', () => {
        it('should work for basic HTTP requests', () => __awaiter(void 0, void 0, void 0, function* () {
            let gotReq = false;
            let gotCallback = false;
            const agent = new src_1.Agent((req, opts) => {
                gotCallback = true;
                assert_1.default.equal(opts.secureEndpoint, false);
                assert_1.default.equal(opts.protocol, 'http:');
                return net_1.default.connect(opts);
            });
            const server = http_1.default.createServer((req, res) => {
                gotReq = true;
                res.setHeader('X-Foo', 'bar');
                res.setHeader('X-Url', req.url || '/');
                res.end();
            });
            yield (0, async_listen_1.default)(server);
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                throw new Error('Server did not bind to a port');
            }
            const { port } = addr;
            try {
                const info = url_1.default.parse(`http://127.0.0.1:${port}/foo`);
                const res = yield req(Object.assign({ agent }, info));
                assert_1.default.equal('bar', res.headers['x-foo']);
                assert_1.default.equal('/foo', res.headers['x-url']);
                (0, assert_1.default)(gotReq);
                (0, assert_1.default)(gotCallback);
            }
            finally {
                server.close();
            }
        }));
        it('should not send a port number for the default port', () => __awaiter(void 0, void 0, void 0, function* () {
            const agent = new src_1.Agent((req, opts) => {
                assert_1.default.equal(opts.secureEndpoint, false);
                assert_1.default.equal(opts.protocol, 'http:');
                assert_1.default.equal(agent.defaultPort, port);
                assert_1.default.equal(opts.port, port);
                return net_1.default.connect(opts);
            });
            const server = http_1.default.createServer((req, res) => {
                res.end(JSON.stringify(req.headers));
            });
            yield (0, async_listen_1.default)(server);
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                throw new Error('Server did not bind to a port');
            }
            const { port } = addr;
            agent.defaultPort = port;
            try {
                const info = url_1.default.parse(`http://127.0.0.1:${port}/foo`);
                const res = yield req(Object.assign({ agent }, info));
                const body = yield json(res);
                assert_1.default.equal(body.host, '127.0.0.1');
            }
            finally {
                server.close();
            }
        }));
        it('should work when overriding `http.globalAgent`', () => __awaiter(void 0, void 0, void 0, function* () {
            let gotReq = false;
            let gotCallback = false;
            const agent = new src_1.Agent((req, opts) => {
                gotCallback = true;
                assert_1.default.equal(opts.secureEndpoint, false);
                assert_1.default.equal(opts.protocol, 'http:');
                return net_1.default.connect(opts);
            });
            const server = http_1.default.createServer((req, res) => {
                gotReq = true;
                res.setHeader('X-Foo', 'bar');
                res.setHeader('X-Url', req.url || '/');
                res.end();
            });
            yield (0, async_listen_1.default)(server);
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                throw new Error('Server did not bind to a port');
            }
            const { port } = addr;
            // Override the default `http.Agent.globalAgent`
            const originalAgent = _http_agent_1.default.globalAgent;
            _http_agent_1.default.globalAgent = agent;
            try {
                const info = url_1.default.parse(`http://127.0.0.1:${port}/foo`);
                const res = yield req(info);
                assert_1.default.equal('bar', res.headers['x-foo']);
                assert_1.default.equal('/foo', res.headers['x-url']);
                (0, assert_1.default)(gotReq);
                (0, assert_1.default)(gotCallback);
            }
            finally {
                server.close();
                _http_agent_1.default.globalAgent = agent;
            }
        }));
        it('should work after the first tick of the `http.ClientRequest` instance', () => __awaiter(void 0, void 0, void 0, function* () {
            let gotReq = false;
            let gotCallback = false;
            const agent = new src_1.Agent((req, opts) => __awaiter(void 0, void 0, void 0, function* () {
                gotCallback = true;
                assert_1.default.equal(opts.secureEndpoint, false);
                assert_1.default.equal(opts.protocol, 'http:');
                yield sleep(10);
                return net_1.default.connect(opts);
            }));
            const server = http_1.default.createServer((req, res) => {
                gotReq = true;
                res.setHeader('X-Foo', 'bar');
                res.setHeader('X-Url', req.url || '/');
                res.end();
            });
            yield (0, async_listen_1.default)(server);
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                throw new Error('Server did not bind to a port');
            }
            const { port } = addr;
            try {
                const info = url_1.default.parse(`http://127.0.0.1:${port}/foo`);
                const res = yield req(Object.assign({ agent }, info));
                assert_1.default.equal('bar', res.headers['x-foo']);
                assert_1.default.equal('/foo', res.headers['x-url']);
                (0, assert_1.default)(gotReq);
                (0, assert_1.default)(gotCallback);
            }
            finally {
                server.close();
            }
        }));
        it('should emit an "error" event on `http.ClientRequest` instance when callback throws sync', () => __awaiter(void 0, void 0, void 0, function* () {
            let gotError = false;
            let gotCallback = false;
            const agent = new src_1.Agent((req, opts) => {
                gotCallback = true;
                throw new Error('bad');
            });
            try {
                const info = url_1.default.parse('http://127.0.0.1/throws');
                yield req(Object.assign({ agent }, info));
            }
            catch (err) {
                gotError = true;
                // @ts-ignore
                assert_1.default.equal(err.message, 'bad');
            }
            (0, assert_1.default)(gotError);
            (0, assert_1.default)(gotCallback);
        }));
        it('should emit an "error" event on `http.ClientRequest` instance when callback throws async', () => __awaiter(void 0, void 0, void 0, function* () {
            let gotError = false;
            let gotCallback = false;
            const agent = new src_1.Agent((req, opts) => __awaiter(void 0, void 0, void 0, function* () {
                gotCallback = true;
                yield sleep(10);
                throw new Error('bad');
            }));
            try {
                const info = url_1.default.parse('http://127.0.0.1/throws');
                yield req(Object.assign({ agent }, info));
            }
            catch (err) {
                gotError = true;
                // @ts-ignore
                assert_1.default.equal(err.message, 'bad');
            }
            (0, assert_1.default)(gotError);
            (0, assert_1.default)(gotCallback);
        }));
    });
    describe('"https" module', () => {
        it('should work for basic HTTPS requests', () => __awaiter(void 0, void 0, void 0, function* () {
            let gotReq = false;
            let gotCallback = false;
            const agent = new src_1.Agent((req, opts) => {
                gotCallback = true;
                assert_1.default.equal(opts.secureEndpoint, true);
                assert_1.default.equal(opts.protocol, 'https:');
                return tls_1.default.connect(opts);
            });
            const server = https_1.default.createServer(sslOptions, (req, res) => {
                gotReq = true;
                res.setHeader('X-Foo', 'bar');
                res.setHeader('X-Url', req.url || '/');
                res.end();
            });
            yield (0, async_listen_1.default)(server);
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                throw new Error('Server did not bind to a port');
            }
            const { port } = addr;
            try {
                const info = url_1.default.parse(`https://127.0.0.1:${port}/foo`);
                const res = yield req(Object.assign({ agent, rejectUnauthorized: false }, info));
                assert_1.default.equal('bar', res.headers['x-foo']);
                assert_1.default.equal('/foo', res.headers['x-url']);
                (0, assert_1.default)(gotReq);
                (0, assert_1.default)(gotCallback);
            }
            finally {
                server.close();
            }
        }));
        it('should work when returning another `agent-base`', () => __awaiter(void 0, void 0, void 0, function* () {
            let gotReq = false;
            let gotCallback1 = false;
            let gotCallback2 = false;
            const agent1 = new src_1.Agent((req, opts) => __awaiter(void 0, void 0, void 0, function* () {
                gotCallback1 = true;
                assert_1.default.equal(opts.secureEndpoint, true);
                assert_1.default.equal(opts.protocol, 'https:');
                return agent2;
            }));
            const agent2 = new src_1.Agent((req, opts) => __awaiter(void 0, void 0, void 0, function* () {
                gotCallback2 = true;
                assert_1.default.equal(opts.secureEndpoint, true);
                assert_1.default.equal(opts.protocol, 'https:');
                return tls_1.default.connect(opts);
            }));
            const server = https_1.default.createServer(sslOptions, (req, res) => {
                gotReq = true;
                res.setHeader('X-Foo', 'bar');
                res.setHeader('X-Url', req.url || '/');
                res.end();
            });
            yield (0, async_listen_1.default)(server);
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                throw new Error('Server did not bind to a port');
            }
            const { port } = addr;
            try {
                const info = url_1.default.parse(`https://127.0.0.1:${port}/foo`);
                const res = yield req(Object.assign({ agent: agent1, rejectUnauthorized: false }, info));
                assert_1.default.equal('bar', res.headers['x-foo']);
                assert_1.default.equal('/foo', res.headers['x-url']);
                (0, assert_1.default)(gotReq);
                (0, assert_1.default)(gotCallback1);
                (0, assert_1.default)(gotCallback2);
            }
            finally {
                server.close();
            }
        }));
        it('should not send a port number for the default port', () => __awaiter(void 0, void 0, void 0, function* () {
            let reqCount = 0;
            const agent = new src_1.Agent((req, opts) => {
                assert_1.default.equal(opts.secureEndpoint, true);
                assert_1.default.equal(opts.protocol, 'https:');
                assert_1.default.equal(agent.defaultPort, port);
                assert_1.default.equal(opts.port, port);
                return tls_1.default.connect(opts);
            });
            const server = https_1.default.createServer(sslOptions, (req, res) => {
                reqCount++;
                res.end(JSON.stringify(req.headers));
            });
            yield (0, async_listen_1.default)(server);
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                throw new Error('Server did not bind to a port');
            }
            const { port } = addr;
            agent.defaultPort = port;
            try {
                const info = url_1.default.parse(`https://127.0.0.1:${port}/foo`);
                const res = yield req(Object.assign({ agent, rejectUnauthorized: false }, info));
                const body = yield json(res);
                assert_1.default.equal(body.host, '127.0.0.1');
                assert_1.default.equal(reqCount, 1);
            }
            finally {
                server.close();
            }
        }));
        if ((0, semver_1.satisfies)(process.version, '>= 10')) {
            it('should work when overriding `https.globalAgent`', () => __awaiter(void 0, void 0, void 0, function* () {
                let gotReq = false;
                let gotCallback = false;
                const agent = new src_1.Agent((req, opts) => {
                    gotCallback = true;
                    assert_1.default.equal(opts.secureEndpoint, true);
                    assert_1.default.equal(opts.protocol, 'https:');
                    return tls_1.default.connect(opts);
                });
                const server = https_1.default.createServer(sslOptions, (req, res) => {
                    gotReq = true;
                    res.setHeader('X-Foo', 'bar');
                    res.setHeader('X-Url', req.url || '/');
                    res.end();
                });
                yield (0, async_listen_1.default)(server);
                const addr = server.address();
                if (!addr || typeof addr === 'string') {
                    throw new Error('Server did not bind to a port');
                }
                const { port } = addr;
                // Override the default `https.globalAgent`
                const originalAgent = https_1.default.globalAgent;
                https_1.default.globalAgent = agent;
                try {
                    const info = url_1.default.parse(`https://127.0.0.1:${port}/foo`);
                    info.rejectUnauthorized = false;
                    const res = yield req(info);
                    assert_1.default.equal('bar', res.headers['x-foo']);
                    assert_1.default.equal('/foo', res.headers['x-url']);
                    (0, assert_1.default)(gotReq);
                    (0, assert_1.default)(gotCallback);
                }
                finally {
                    server.close();
                    https_1.default.globalAgent = originalAgent;
                }
            }));
        }
    });
});
//# sourceMappingURL=test.js.map
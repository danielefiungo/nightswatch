import { Headers } from './../config/options';
import debugLib from 'debug';
import { Request } from 'express';
import {
  createProxyMiddleware,
  Options,
  RequestHandler,
} from 'http-proxy-middleware';
import { isNumber, round } from 'lodash';
import get from 'lodash.get';
import map from 'lodash.map';
import options, { Targets } from '../config/options';

const debug = debugLib('nightswatch:rev-proxy');

function revProxy({ upstream, routes, rewrite }: Targets): RequestHandler {
  const proxy_options: Options = {
    followRedirects: false,
    changeOrigin: true,
    target: upstream,
    pathRewrite: rewrite.reduce((acc, { match, rewrite }) => {
      acc[match] = rewrite;
      return acc;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, {} as any),
    // control logging
    logLevel: 'debug',

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router: routes.reduce((acc: any, route) => {
      acc[route.path] = route.upstream;
      return acc;
    }, {}),

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    onProxyReq: (proxyReq, req, res) => {
      const rpHeaders = proxyHeaders(req);
      rpHeaders.forEach(([name, value]) => {
        proxyReq.setHeader(name, value);
      });
    },
  };

  function proxyHeaders(req: Request) {
    const { prefix, proxy } = options.snapshot().relying_party.headers;
    const headers = map(proxy, function(value, name) {
      let uidValue = get(req.uid, value, '');
      if (name === 'expiresin' && isNumber(uidValue)) {
        uidValue = round((uidValue * 1000 - Date.now()) / 1000, 0);
      }
      return [`${prefix}-${name}`, uidValue];
    });
    return headers;
  }

  debug(proxy_options);

  return createProxyMiddleware(proxy_options);
}

export default revProxy;

/**
 * @import { Server } from 'node:http'
 * @import Koa from 'koa'
 * @import serve from 'koa-static'
 */

/**
 * @typedef {{ pluginName?: string, useWriteBundle?: boolean, dirs?: string | string[], port?: number, useKoaLogger?: boolean, koaStaticOptions?: serve.Options, host?: string, https?: { cert: string, key: string, ca?: string }, customizeKoa?: (koa: Koa) => void, onListen?: (server: Server) => void | true }} ServePluginOptionsObject
 */

/**
 * @typedef {ServePluginOptionsObject | string | string[]} ServePluginOptions
 */

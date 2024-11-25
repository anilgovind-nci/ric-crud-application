"use strict";
/*
 * Unless explicitly stated otherwise all files in this repository are licensed
 * under the Apache License Version 2.0.
 *
 * This product includes software developed at Datadog (https://www.datadoghq.com/).
 * Copyright 2021 Datadog, Inc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.enableTracing = exports.TracingMode = void 0;
const ddTraceEnabledEnvVar = "DD_TRACE_ENABLED";
const ddMergeXrayTracesEnvVar = "DD_MERGE_XRAY_TRACES";
var TracingMode;
(function (TracingMode) {
    TracingMode[TracingMode["XRAY"] = 0] = "XRAY";
    TracingMode[TracingMode["DD_TRACE"] = 1] = "DD_TRACE";
    TracingMode[TracingMode["HYBRID"] = 2] = "HYBRID";
    TracingMode[TracingMode["NONE"] = 3] = "NONE";
})(TracingMode = exports.TracingMode || (exports.TracingMode = {}));
function enableTracing(service, tracingMode, handlers) {
    var _a;
    const provider = service.provider;
    if (tracingMode === TracingMode.XRAY || tracingMode === TracingMode.HYBRID) {
        provider.tracing = {
            apiGateway: ((_a = provider.apiGateway) === null || _a === void 0 ? void 0 : _a.restApiId)
                ? undefined // Current type definition does not allow undefined however it is a valid option.
                : true,
            lambda: true,
        };
    }
    handlers.forEach(({ handler }) => {
        var _a;
        (_a = handler.environment) !== null && _a !== void 0 ? _a : (handler.environment = {});
        const environment = handler.environment;
        // if tracing is not enabled, merge x-ray cannot be enabled
        if (environment[ddTraceEnabledEnvVar] === false || environment[ddTraceEnabledEnvVar] === "false") {
            environment[ddMergeXrayTracesEnvVar] = false;
        }
    });
}
exports.enableTracing = enableTracing;
//# sourceMappingURL=tracing.js.map
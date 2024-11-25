import Service from "serverless/classes/Service";
import { FunctionInfo } from "./layer";
export declare enum TracingMode {
    XRAY = 0,
    DD_TRACE = 1,
    HYBRID = 2,
    NONE = 3
}
export declare function enableTracing(service: Service, tracingMode: TracingMode, handlers: FunctionInfo[]): void;
//# sourceMappingURL=tracing.d.ts.map
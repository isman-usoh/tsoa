import { Tsoa } from '../metadataGeneration/tsoa';
import { RoutesConfig } from './../config';
export declare class RouteGenerator {
    private readonly metadata;
    private readonly options;
    constructor(metadata: Tsoa.Metadata, options: RoutesConfig);
    GenerateRoutes(middlewareTemplate: string, pathTransformer: (path: string) => string): Promise<void>;
    GenerateCustomRoutes(template: string, pathTransformer: (path: string) => string): void;
    private buildContent(middlewareTemplate, pathTransformer);
    private getModels();
    private getRelativeImportPath(fileLocation);
    private getPropertySchema(source);
    private getTemplateAdditionalProperty(type);
    private getParameterSchema(source);
}

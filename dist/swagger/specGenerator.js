"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var SpecGenerator = (function () {
    function SpecGenerator(metadata, config) {
        this.metadata = metadata;
        this.config = config;
    }
    SpecGenerator.prototype.GetSpec = function () {
        var spec = {
            basePath: this.config.basePath,
            consumes: ['application/json'],
            definitions: this.buildDefinitions(),
            info: {
                title: '',
            },
            paths: this.buildPaths(),
            produces: ['application/json'],
            swagger: '2.0',
        };
        spec.securityDefinitions = this.config.securityDefinitions
            ? this.config.securityDefinitions
            : {};
        if (this.config.name) {
            spec.info.title = this.config.name;
        }
        if (this.config.version) {
            spec.info.version = this.config.version;
        }
        if (this.config.host) {
            spec.host = this.config.host;
        }
        if (this.config.description) {
            spec.info.description = this.config.description;
        }
        if (this.config.license) {
            spec.info.license = { name: this.config.license };
        }
        if (this.config.spec) {
            this.config.specMerging = this.config.specMerging || 'immediate';
            var mergeFuncs = {
                immediate: Object.assign,
                recursive: require('merge').recursive,
            };
            spec = mergeFuncs[this.config.specMerging](spec, this.config.spec);
        }
        return spec;
    };
    SpecGenerator.prototype.buildDefinitions = function () {
        var _this = this;
        var definitions = {};
        Object.keys(this.metadata.referenceTypeMap).map(function (typeName) {
            var referenceType = _this.metadata.referenceTypeMap[typeName];
            // Object definition
            if (referenceType.properties) {
                var required = referenceType.properties.filter(function (p) { return p.required; }).map(function (p) { return p.name; });
                definitions[referenceType.refName] = {
                    description: referenceType.description,
                    properties: _this.buildProperties(referenceType.properties),
                    required: required && required.length > 0 ? Array.from(new Set(required)) : undefined,
                    type: 'object',
                };
                if (referenceType.additionalProperties) {
                    definitions[referenceType.refName].additionalProperties = _this.buildAdditionalProperties(referenceType.additionalProperties);
                }
            }
            // Enum definition
            if (referenceType.enums) {
                definitions[referenceType.refName] = {
                    description: referenceType.description,
                    enum: referenceType.enums,
                    type: 'string',
                };
            }
        });
        return definitions;
    };
    SpecGenerator.prototype.buildPaths = function () {
        var _this = this;
        var paths = {};
        this.metadata.controllers.forEach(function (controller) {
            controller.methods.forEach(function (method) {
                var path = "" + (controller.path ? "/" + controller.path : '') + method.path;
                paths[path] = paths[path] || {};
                _this.buildMethod(controller.name, method, paths[path]);
            });
        });
        return paths;
    };
    SpecGenerator.prototype.buildMethod = function (controllerName, method, pathObject) {
        var _this = this;
        var pathMethod = pathObject[method.method] = this.buildOperation(controllerName, method);
        pathMethod.description = method.description;
        pathMethod.summary = method.summary;
        if (method.deprecated) {
            pathMethod.deprecated = method.deprecated;
        }
        if (method.tags.length) {
            pathMethod.tags = method.tags;
        }
        if (method.security) {
            var security = {};
            security[method.security.name] = method.security.scopes ? method.security.scopes : [];
            pathMethod.security = [security];
        }
        pathMethod.parameters = method.parameters
            .filter(function (p) {
            return !(p.in === 'request' || p.in === 'body-prop');
        })
            .map(function (p) { return _this.buildParameter(p); });
        var bodyPropParameter = this.buildBodyPropParameter(controllerName, method);
        if (bodyPropParameter) {
            pathMethod.parameters.push(bodyPropParameter);
        }
        if (pathMethod.parameters.filter(function (p) { return p.in === 'body'; }).length > 1) {
            throw new Error('Only one body parameter allowed per controller method.');
        }
    };
    SpecGenerator.prototype.buildBodyPropParameter = function (controllerName, method) {
        var _this = this;
        var properties = {};
        var required = [];
        method.parameters
            .filter(function (p) { return p.in === 'body-prop'; })
            .forEach(function (p) {
            properties[p.name] = _this.getSwaggerType(p.type);
            if (!properties[p.name].$ref) {
                properties[p.name].description = p.description;
            }
            if (p.required) {
                required.push(p.name);
            }
        });
        if (!Object.keys(properties).length) {
            return;
        }
        var parameter = {
            in: 'body',
            name: 'body',
            schema: {
                properties: properties,
                title: this.getOperationId(controllerName, method.name) + "Body",
                type: 'object',
            },
        };
        if (required.length) {
            parameter.schema.required = required;
        }
        return parameter;
    };
    SpecGenerator.prototype.buildParameter = function (parameter) {
        var swaggerParameter = {
            description: parameter.description,
            in: parameter.in,
            name: parameter.name,
            required: parameter.required,
        };
        var parameterType = this.getSwaggerType(parameter.type);
        if (parameterType.$ref) {
            swaggerParameter.schema = parameterType;
        }
        else {
            if (parameter.type.dataType === 'any') {
                if (parameter.in === 'body') {
                    swaggerParameter.schema = { type: 'object' };
                }
                else {
                    swaggerParameter.type = 'string';
                }
            }
            else {
                swaggerParameter.type = parameterType.type;
                swaggerParameter.items = parameterType.items;
                swaggerParameter.enum = parameterType.enum;
            }
        }
        if (parameterType.format) {
            swaggerParameter.format = parameterType.format;
        }
        Object.keys(parameter.validators)
            .filter(function (key) {
            return !key.startsWith('is') && key !== 'minDate' && key !== 'maxDate';
        })
            .forEach(function (key) {
            swaggerParameter[key] = parameter.validators[key].value;
        });
        return swaggerParameter;
    };
    SpecGenerator.prototype.buildProperties = function (properties) {
        var _this = this;
        var swaggerProperties = {};
        properties.forEach(function (property) {
            var swaggerType = _this.getSwaggerType(property.type);
            if (!swaggerType.$ref) {
                swaggerType.description = property.description;
                Object.keys(property.validators)
                    .filter(function (key) {
                    return !key.startsWith('is') && key !== 'minDate' && key !== 'maxDate';
                })
                    .forEach(function (key) {
                    swaggerType[key] = property.validators[key].value;
                });
            }
            swaggerProperties[property.name] = swaggerType;
        });
        return swaggerProperties;
    };
    SpecGenerator.prototype.buildAdditionalProperties = function (type) {
        return this.getSwaggerType(type);
    };
    SpecGenerator.prototype.buildOperation = function (controllerName, method) {
        var _this = this;
        var swaggerResponses = {};
        method.responses.forEach(function (res) {
            swaggerResponses[res.name] = {
                description: res.description,
            };
            if (res.schema && res.schema.dataType !== 'void') {
                swaggerResponses[res.name]['schema'] = _this.getSwaggerType(res.schema);
            }
            if (res.examples) {
                swaggerResponses[res.name]['examples'] = { 'application/json': res.examples };
            }
        });
        return {
            operationId: this.getOperationId(controllerName, method.name),
            produces: ['application/json'],
            responses: swaggerResponses,
        };
    };
    SpecGenerator.prototype.getOperationId = function (controllerName, methodName) {
        var controllerNameWithoutSuffix = controllerName.replace(new RegExp('Controller$'), '');
        return "" + controllerNameWithoutSuffix + (methodName.charAt(0).toUpperCase() + methodName.substr(1));
    };
    SpecGenerator.prototype.getSwaggerType = function (type) {
        var swaggerType = this.getSwaggerTypeForPrimitiveType(type);
        if (swaggerType) {
            return swaggerType;
        }
        if (type.dataType === 'array') {
            return this.getSwaggerTypeForArrayType(type);
        }
        if (type.dataType === 'enum') {
            return this.getSwaggerTypeForEnumType(type);
        }
        return this.getSwaggerTypeForReferenceType(type);
    };
    SpecGenerator.prototype.getSwaggerTypeForPrimitiveType = function (type) {
        var map = {
            any: { type: 'object' },
            binary: { type: 'string', format: 'binary' },
            boolean: { type: 'boolean' },
            buffer: { type: 'string', format: 'byte' },
            byte: { type: 'string', format: 'byte' },
            date: { type: 'string', format: 'date' },
            datetime: { type: 'string', format: 'date-time' },
            double: { type: 'number', format: 'double' },
            float: { type: 'number', format: 'float' },
            integer: { type: 'integer', format: 'int32' },
            long: { type: 'integer', format: 'int64' },
            object: { type: 'object' },
            string: { type: 'string' },
        };
        return map[type.dataType];
    };
    SpecGenerator.prototype.getSwaggerTypeForArrayType = function (arrayType) {
        return { type: 'array', items: this.getSwaggerType(arrayType.elementType) };
    };
    SpecGenerator.prototype.getSwaggerTypeForEnumType = function (enumType) {
        return { type: 'string', enum: enumType.enums.map(function (member) { return String(member); }) };
    };
    SpecGenerator.prototype.getSwaggerTypeForReferenceType = function (referenceType) {
        return { $ref: "#/definitions/" + referenceType.refName };
    };
    return SpecGenerator;
}());
exports.SpecGenerator = SpecGenerator;
//# sourceMappingURL=specGenerator.js.map
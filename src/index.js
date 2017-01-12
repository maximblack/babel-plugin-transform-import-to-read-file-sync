import {equal} from 'assert';
import template from 'babel-template';
import {readFileSync} from 'fs';
import {resolve, dirname} from 'path';

const fromSourceString = code => template(`(${code})`)().expression;

export default ({types: {
    callExpression,
    identifier,
    importDeclaration,
    importSpecifier,
    expressionStatement,
    expression,
    memberExpression,
    stringLiteral,
    literal,
    variableDeclaration,
    variableDeclarator,

    isImportDeclaration,
    isImportDefaultSpecifier,
    isImportNamespaceSpecifier,
    isImportSpecifier,
    isStringLiteral,

    valueToNode,

    assertImportDefaultSpecifier
}}) => {
    const testOptions = (opts, value, fileDir, match) => {
        const optsArray = Array.isArray(opts) ? opts : [opts];
        optsArray.some(({options, test}) => {
            if (test && new RegExp(test).test(value)) {
                const matches = value.match(new RegExp(test));
                return match(readFileSyncCallExpressionArgs(matches[1] || value, options, fileDir));
            }
        });
    }
    const readFileSyncCallExpressionArgs = (value, options, fileDir) => {
        // [require.resolve(<file>)[, encoding|options]]
        /*var isBuffer = false;
        if (enc === null || enc === undefined) {
            isBuffer = true;
            enc = 'base64';
        }
        if (enc && typeof enc === 'object' && enc.encoding) {
            enc = enc.encoding;
        }*/
        const modulePath = resolve(fileDir, value);

        const result = readFileSync(modulePath, 'utf8'/*enc*/);

        /*// Submit new dependencies back to webpack/browserify.
        // This is currently a bit ugly, but it appears to be
        // a limitation of Babel's plugin architecture, there
        // is no documented/clean way of bubbling this back up
        // to the bundler.
        instance.onFile(file);*/

        /*if (isBuffer) {
            return buffer({
                CONTENT: t.stringLiteral(result),
                ENC: t.stringLiteral(enc)
            });
        }*/

        console.log('stringLiteral', stringLiteral(result.toString()));
        //console.log('literal', literal(result.toString()));

        return stringLiteral(result.toString());

        /*const args = [
            callExpression(
                memberExpression(
                    identifier('require'),
                    identifier('resolve')
                ),
                [stringLiteral(value)]
            )
        ];
        if (options) {
            // Second argument to readFileSync can be string or object
            args.push(fromSourceString(JSON.stringify(options)));
        }
        return args;*/
    };
    return {
        visitor: {
            ImportDeclaration(path, state) {
                const { opts } = state;
                const filename = state.file.opts.filename;

                const fileDir = dirname(filename);

                const {specifiers, source: {value}} = path.node;
                testOptions(opts, value, fileDir, readFileSyncArgs => {
                    equal(specifiers.length, 1, 'Number of import specifiers.');
                    assertImportDefaultSpecifier(specifiers[0]);
                    const {local} = specifiers[0];
                    // Search import <specifiers> 'fs';
                    let readFileSync;
                    const fsImportDeclarations = path.parent.body
                        .filter(isImportDeclaration)
                        .filter(({source: {value}}) => value === 'fs');
                    if (!fsImportDeclarations.some(({specifiers}) => specifiers.find(specifier => {
                        if (isImportDefaultSpecifier(specifier) || isImportNamespaceSpecifier(specifier)) {
                            readFileSync = memberExpression(specifier.local, identifier('readFileSync'));
                            return true;
                        }
                        if (isImportSpecifier(specifier)) {
                            if (specifier.imported.name === 'readFileSync') {
                                readFileSync = specifier.local;
                                return true;
                            }
                        }
                    }))) {
                        /*!// fs is not imported
                        readFileSync = path.scope.generateUidIdentifier('readFileSync');
                        // Add import { readFileSync as _readFileSync } from 'fs';
                        path.insertBefore(importDeclaration(
                            [importSpecifier(readFileSync, identifier('readFileSync'))],
                            stringLiteral('fs')
                        ));*/
                    }
                    // const <localName> = <readFileSync>(<args>);
                    path.replaceWith(
                        variableDeclaration('const', [
                            variableDeclarator(
                                local,
                                readFileSyncArgs
                               // expressionStatement(readFileSyncArgs)
                                /*callExpression(
                                    readFileSync,
                                    readFileSyncArgs
                                )*/
                            )
                        ])
                    );
                    return true;
                });
            },
            CallExpression(path, {opts}) {
                if (path.node.callee.name === 'require') {
                    const args = path.node.arguments;
                    if (args.length) {
                        const arg = args[0];
                        if (isStringLiteral(arg)) {
                            testOptions(opts, arg.value, readFileSyncArgs => {
                                // require('fs').readFileSync(<args>)
                                path.replaceWith(callExpression(
                                    memberExpression(
                                        callExpression(
                                            identifier('require'),
                                            [stringLiteral('fs')]
                                        ),
                                        identifier('readFileSync')
                                    ),
                                    readFileSyncArgs
                                ));
                                return true;
                            });
                        }
                    }
                }
            }
        }
    }
};

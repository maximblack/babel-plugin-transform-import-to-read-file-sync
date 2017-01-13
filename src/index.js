import {equal} from 'assert';
import template from 'babel-template';
import {readFileSync, existsSync} from 'fs';
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
    const testOptions = (opts, value, fileDir, sourceRoot, match) => {
        const optsArray = Array.isArray(opts) ? opts : [opts];
        optsArray.some(({options, test, resolve, module}) => {;
            if (test && new RegExp(test).test(value)) {
                const regExpTest = new RegExp(test);
                const matches = value.match(regExpTest);
                return match(readFileSyncStringLiteral(matches[1] || value, {options, resolve, module}, fileDir, sourceRoot));
            }
        });
    }
    const readFileSyncStringLiteral = (value, {options, module, resolve: extensions}, fileDir, sourceRoot) => {
        extensions = extensions || [''];

        for(let i in extensions) {

            let modulePath = '';
            if(module) {
                modulePath = sourceRoot + '/node_modules/' + module + '/' + value + extensions[i];
            } else {
                modulePath = resolve(fileDir, value + extensions[i]);
            }

            //console.log('modulePath', modulePath);
            //return stringLiteral(modulePath);

            if(existsSync(modulePath)) {
                const contents = readFileSync(modulePath, 'utf8'/*enc*/);
                return stringLiteral(contents.toString());
            }

        }

        return stringLiteral('');

    };
    return {
        visitor: {
            ImportDeclaration(path, state) {
                const { opts } = state;

                // Get imported filename
                const filename = state.file.opts.filename;

                const sourceRoot = state.file.opts.sourceRoot;

                // Get file dir from visitor
                const fileDir = dirname(filename);

                const {specifiers, source: {value}} = path.node;

                testOptions(opts, value, fileDir, sourceRoot, stringLiteral => {
                    equal(specifiers.length, 1, 'Number of import specifiers.');
                    assertImportDefaultSpecifier(specifiers[0]);
                    const {local} = specifiers[0];

                    // const <localName> = 'fileContents';
                    path.replaceWith(
                        variableDeclaration('const', [
                            variableDeclarator(
                                local,
                                stringLiteral
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

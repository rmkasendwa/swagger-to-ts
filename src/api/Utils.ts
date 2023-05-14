import { ModuleImports } from '../models';

//#region Add module import
export interface AddModuleImportOptions {
  imports: ModuleImports;
  importFilePath: string;
  importName: string;
  isDefaultImport?: boolean;
}
export const addModuleImport = ({
  imports,
  importFilePath,
  importName,
}: AddModuleImportOptions) => {
  if (!imports[importFilePath]) {
    imports[importFilePath] = [];
  }
  if (!imports[importFilePath].includes(importName)) {
    imports[importFilePath].push(importName);
  }
};
//#endregion

//#region get imports code
export interface GetImportsCodeOptions {
  imports?: ModuleImports;
}
export const getImportsCode = ({ imports }: GetImportsCodeOptions) => {
  if (imports) {
    return Object.keys(imports!).map((importFilePath) => {
      const importNames = imports![importFilePath];
      return `import { ${importNames.join(', ')} } from '${importFilePath}';`;
    });
  }
  return [];
};
//#endregion

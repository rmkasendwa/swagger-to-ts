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

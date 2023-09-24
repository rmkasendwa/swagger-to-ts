import { PermissionsCodeConfiguration, RequestGroupings } from '../models';

//#region API functions code generator
export interface GeneratePermissionsCodeConfigurationOptions {
  /**
   * The request groupings to generate code for.
   */
  requestGroupings: RequestGroupings;

  /**
   * The name of the local scope.
   */
  localScopeName: string;
}
export const getPermissionsCodeConfiguration = ({
  requestGroupings,
  localScopeName,
}: GeneratePermissionsCodeConfigurationOptions) => {
  return Object.entries(requestGroupings).reduce<PermissionsCodeConfiguration>(
    (accumulator, [tagName, requestGrouping]) => {
      const upperCaseTagName = tagName.replace(/\W+/g, '_').toUpperCase();
      const snakeCaseTagName = tagName.replace(/\W+/g, '_').toLowerCase();
      const pascalCaseTagName = tagName.toPascalCase();
      const manageModulePermissionsVariableName = `MANAGE_${upperCaseTagName}_PERMISSON`;
      const permissionCodeExports = [
        `export const ${manageModulePermissionsVariableName} = 'MANAGE_${upperCaseTagName}';`,
      ];
      requestGrouping.requests.forEach((request) => {
        request['x-requestConfig']?.tsedControllerConfig?.permissions?.forEach(
          (permission) => {
            const permissionString = `${
              localScopeName !== 'Root' ? localScopeName + '_' : ''
            }${permission}`
              .replace(/\W+/g, '_')
              .toUpperCase();
            const permissionExportVariableName = `${permissionString}_PERMISSION`;
            permissionCodeExports.push(
              `export const ${permissionExportVariableName} = ${JSON.stringify(
                permissionString
              )};`
            );
          }
        );
      });

      const permissionsListExport = `
        export const all${pascalCaseTagName}Permissions = [
          {
            category: '${pascalCaseTagName}',
            code: ${manageModulePermissionsVariableName},
            scope: '${snakeCaseTagName}',
            description:
              'A user with this permission can perform all operations on ${tagName}',
            name: 'Manage ${tagName}',
            parentPermissionCode: 'ALL_FUNCTIONS',
          }
        ];
      `.trimIndent();

      const outputCode = `
        ${permissionCodeExports.join('\n')}

        ${permissionsListExport}
      `.trimIndent();

      accumulator[tagName] = {
        outputCode,
        exports: [...permissionCodeExports, permissionsListExport],
      };

      return accumulator;
    },
    {}
  );
};
//#endregion

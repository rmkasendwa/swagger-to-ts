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
      const manageModulePermissionCode = `MANAGE_${upperCaseTagName}`;
      const manageModulePermissionsVariableName = `${manageModulePermissionCode}_PERMISSION`;
      const permissionCodeExports = [
        `export const ${manageModulePermissionsVariableName} = 'MANAGE_${upperCaseTagName}';`,
      ];
      const permissionsListExportItemsCode = [
        `
          {
            category: '${pascalCaseTagName}',
            code: ${manageModulePermissionsVariableName},
            scope: '${snakeCaseTagName}',
            description:
              'A user with this permission can perform all operations on ${tagName}',
            name: 'Manage ${tagName}',
            parentPermissionCode: 'ALL_FUNCTIONS',
          },
        `.trimIndent(),
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

      if (requestGrouping.permissons) {
        requestGrouping.permissons.forEach((permision) => {
          const { code } = permision;
          const normalizedCode = code.replace(/\W+/g, '_').toUpperCase();
          permissionCodeExports.push(
            `export const ${normalizedCode}_PERMISSION = ${JSON.stringify(
              normalizedCode
            )};`
          );
          permissionsListExportItemsCode.push(
            '{\n' +
              Object.entries({
                ...permision,
                ...(() => {
                  if (!permision.parentPermissionCode) {
                    return {
                      parentPermissionCode: manageModulePermissionCode,
                    };
                  }
                })(),
              })
                .map(([key, value]) => {
                  if (key === 'code') {
                    return `${key}: ${normalizedCode}_PERMISSION,`;
                  }
                  if (key === 'parentPermissionCode' && value) {
                    return `${key}: ${value
                      .replace(/\W+/g, '_')
                      .toUpperCase()}_PERMISSION,`;
                  }
                  return `${key}: ${JSON.stringify(value)},`;
                })
                .join('\n') +
              '\n},'
          );
        });
      }

      const permissionsListExport = `
        export const all${pascalCaseTagName}Permissions = [
          ${permissionsListExportItemsCode.join('\n')}
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

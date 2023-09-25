import { PermissionsCodeConfiguration, RequestGroupings } from '../models';

//#region API functions code generator
export interface GeneratePermissionsCodeConfigurationOptions {
  /**
   * The request groupings to generate code for.
   */
  requestGroupings: RequestGroupings;

  /**
   * The prefix to use for the scoped model.
   */
  scopedModelPrefix?: string;
}
export const getPermissionsCodeConfiguration = ({
  requestGroupings,
  scopedModelPrefix,
}: GeneratePermissionsCodeConfigurationOptions) => {
  return Object.entries(requestGroupings).reduce<PermissionsCodeConfiguration>(
    (accumulator, [tagName, requestGrouping]) => {
      const scopedTagName =
        (scopedModelPrefix ? scopedModelPrefix + ' ' : '') + tagName;
      const upperCaseTagName = scopedTagName.replace(/\W+/g, '_').toUpperCase();
      const snakeCaseTagName = scopedTagName.replace(/\W+/g, '_').toLowerCase();
      const manageModulePermissionCode = `MANAGE_${upperCaseTagName}`;
      const manageModulePermissionsVariableName = `${manageModulePermissionCode}_PERMISSION`;
      const permissionCodeExports = [
        `export const ${manageModulePermissionsVariableName} = 'MANAGE_${upperCaseTagName}';`,
      ];
      const permissionsListExportItemsCode = [
        `
          {
            category: '${scopedTagName}',
            code: ${manageModulePermissionsVariableName},
            scope: '${snakeCaseTagName}',
            description:
              'A user with this permission can perform all operations on ${scopedTagName}',
            name: 'Manage ${scopedTagName}',
            parentPermissionCode: 'ALL_FUNCTIONS',
          },
        `.trimIndent(),
      ];

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
                category: scopedTagName,
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
        export const all${tagName.toPascalCase()}Permissions = [
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

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
    (accumulator, [tag, requestGrouping]) => {
      const exports: string[] = [];
      requestGrouping.requests.forEach((request) => {
        request['x-requestConfig']?.tsedControllerConfig?.permissions?.forEach(
          (permission) => {
            const permissionString = `${
              localScopeName !== 'Root' ? localScopeName + '_' : ''
            }${permission}`
              .replace(/\W+/g, '_')
              .toUpperCase();
            const permissionExportVariableName = `${permissionString}_PERMISSION`;
            exports.push(
              `export const ${permissionExportVariableName} = ${JSON.stringify(
                permissionString
              )};`
            );
          }
        );
      });
      const outputCode = exports.join('\n');

      accumulator[tag] = {
        outputCode,
        exports,
      };

      return accumulator;
    },
    {}
  );
};
//#endregion

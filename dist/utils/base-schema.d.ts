export interface BaseSchema {
  /**
   * The path to create the component.
   */
  path?: string;
  /**
   * The path of the source directory.
   */
  sourceDir?: string;
  /**
   * The root of the application.
   */
  appRoot?: string;
  /**
   * The name of the component.
   */
  name: string;
  /**
   * Specifies if the style will be in the ts file.
   */
  inlineStyle?: boolean;
  /**
   * Specifies if the template will be in the ts file.
   */
  inlineTemplate?: boolean;
  /**
   * Specifies the view encapsulation strategy.
   */
  viewEncapsulation?: ('Emulated' | 'Native' | 'None');
  /**
   * Specifies the change detection strategy.
   */
  changeDetection?: ('Default' | 'OnPush');
  /**
   * The prefix to apply to generated selectors.
   */
  prefix?: string;
  /**
   * The file extension to be used for style files.
   */
  styleext?: string;
  /**
   * Specifies if a spec file is generated.
   */
  spec?: boolean;
  /**
   * Flag to indicate if a dir is created.
   */
  flat?: boolean;
  /**
   * Flag to skip the module import.
   */
  skipImport?: boolean;
  /**
   * The selector to use for the component.
   */
  selector?: string;
  /**
   * Allows specification of the declaring module.
   */
  module?: string;
  /**
   * Specifies if declaring module exports the component.
   */
  export?: boolean;
}

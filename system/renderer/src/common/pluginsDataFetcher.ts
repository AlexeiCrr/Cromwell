import { BasePageNames, StaticPageContext, getStoreItem } from "@cromwell/core";
import { getRestAPIClient } from '@cromwell/core-frontend';
import { checkCMSConfig } from "../helpers/checkCMSConfig";
import { projectRootDir } from '../constants';
/**
 * Fetches data for all plugins at specified page. Server-side only.
 * @param pageName 
 * @param context - StaticPageContext of Page
 */
export const pluginsDataFetcher = async (pageName: BasePageNames | string, context: StaticPageContext): Promise<{
    pluginsData: Record<string, any>;
    pluginsSettings: Record<string, any>;
    pluginsBundles: Record<string, string>;
}> => {
    const cmsconfig = getStoreItem('cmsconfig');
    if (!cmsconfig || !cmsconfig.themeName) {
        console.log('cmsconfig', cmsconfig)
        throw new Error('pluginsDataFetcher !cmsconfig.themeName');
    }
    const restAPIClient = getRestAPIClient();
    const pluginsModifications = await restAPIClient?.getPluginsModifications(pageName);

    const pluginConfigs = pluginsModifications ? Object.entries(pluginsModifications) : undefined;
    // console.log('pageName', pageName, 'pluginConfigs', JSON.stringify(pluginConfigs))
    const pluginsData: Record<string, any> = {};
    const pluginsSettings: Record<string, any> = {}
    const pluginsBundles: Record<string, string> = {};


    if (pluginConfigs && Array.isArray(pluginConfigs)) {
        for (const pluginConfigEntry of pluginConfigs) {
            // console.log('pluginConfig', pluginConfig);
            const pluginName = pluginConfigEntry[0];
            const pluginConfig = pluginConfigEntry[1];
            const pluginContext = Object.assign({}, context);
            pluginContext.pluginsConfig = pluginConfig;

            const settings = await restAPIClient?.getPluginSettings(pluginName);
            if (settings) pluginsSettings[pluginName] = settings;

            // Get frontend bundle
            const frontendBundle = await restAPIClient?.getPluginFrontendBundle(pluginName);
            if (frontendBundle) pluginsBundles[pluginName] = frontendBundle;

            if (!frontendBundle) {
                console.error('Frontend bundle of the Plugin ' + pluginName + ' was not found, but used by name at page: ' + pageName)
            }

            // Require module
            // console.log('pluginConfigObj', pageName, pluginName, pluginConfigObj)
            if (pluginConfig.frontendModule) {
                try {


                    // old way
                    // const plugin = await importPlugin(pluginName);

                    // @TODO read code as text and execute via Function();
                    const plugin = require(pluginConfig.frontendModule);

                    if (!plugin) {
                        console.error('cjs build of the Plugin ' + pluginName + ' was not imported, but used by name at page ' + pageName)
                    } else {
                        const getStaticProps = plugin.getStaticProps;
                        // console.log('plugin', plugin, 'getStaticProps', getStaticProps)

                        let pluginStaticProps = {};
                        if (getStaticProps) {
                            try {
                                pluginStaticProps = await getStaticProps(pluginContext);
                                pluginStaticProps = JSON.parse(JSON.stringify(pluginStaticProps));
                            } catch (e) {
                                console.error('pluginsDataFetcher1', e);
                            }
                        }
                        pluginsData[pluginName] = pluginStaticProps;
                    }

                } catch (e) {
                    console.error('pluginsDataFetcher2', e);
                }
            }

        }
    }
    return {
        pluginsData,
        pluginsSettings,
        pluginsBundles
    };
}


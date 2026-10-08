import type { InfoContract } from "breeze-plugin-kit";
import { PLUGIN_ID } from "./common";

export function buildPluginInfo(): InfoContract {
  return {
    name: "漫画柜",
    uuid: PLUGIN_ID,
    iconUrl: "https://tw.manhuagui.com/favicon.ico",
    describe: "漫画柜（看漫画）繁体版源站插件",
    version: "0.0.3",
    home: "https://github.com/deretame/Breeze-plugin-ManHuaGui",
    updateUrl: "https://api.github.com/repos/deretame/Breeze-plugin-ManHuaGui/releases/latest",
    npmName: "breeze-plugin-man-hua-gui",
    function: [],
  };
}

export function buildManifestInfo(): InfoContract {
  return buildPluginInfo();
}

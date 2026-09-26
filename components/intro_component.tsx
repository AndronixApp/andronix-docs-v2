import React from "react";
import Card from "./card";
import {AiFillSafetyCertificate} from "react-icons/ai";
import {RiDownload2Fill, RiTerminalBoxFill} from "react-icons/ri";
import {SiAndroid} from "react-icons/si";
import {ModdedGlyph} from "./marks";

export default function IntroComponent() {
    return (
        <div>
            <div className={"grid grid-cols-1 lg:grid-cols-2 gap-3 my-4"}>
                <Card badgeText={"Installation"} href={"/install/with-the-app"} className={""} title={"Install an OS with Andronix"}
                      icon={RiDownload2Fill}>Learn
                    how to install distros like Ubuntu, Debian etc. with Andronix</Card>
                <Card badgeText={"Installation"} href={"/modded-os/modded-os-installation"} className={""} title={"Install Modded OS"}
                      icon={ModdedGlyph}>Learn how to
                    install Modded OS like Ubuntu KDE, Manjaro XFCE easily with Andronix.</Card>
                <Card badgeText={"Tutorial"} href={"/troubleshooting/signal-9"} className={""} title={"Process complete- Error Termux"}
                      icon={RiTerminalBoxFill}>Learn how to resolve "Process completed (signal 9) - press Enter" error.</Card>
                <Card badgeText={"Error"} href={"/start-here/install-termux"} className={""} title={"How to install Termux"} icon={SiAndroid}>Learn how to install Termux app from the F-Droid store to ensure compatibility.</Card>
            </div>
        </div>
    )
}

#!/bin/bash

# convenience script to create Firefox extension

RELEASE_TEMP_DIR="/tmp/web-marker"
DEV_TEMP_DIR="${HOME}/tmp/web-marker"
MANIFEST="chrome.manifest"
VERSION="0.7"
DEV=0

TEMP_DIR=${RELEASE_TEMP_DIR}

function release_packager()
{
    dir=$1
    cd ${dir}
    cd chrome
    jar -cvf webmarker.jar *
    rm -rf skin content locale
    cd ..
    zip -r ../webmarker-${VERSION}.xpi *
}

function dev_packager()
{
    dir=$1
    cd ${dir}
    perl -pi -e 's/jar://g' chrome.manifest
    perl -pi -e 's/\/webmarker\.jar!//g' chrome.manifest
}

while getopts "d" type
do
   case $type in 
   d ) DEV=1; 
       TEMP_DIR=${DEV_TEMP_DIR};
       ;;
   esac
done

rm -rf ${TEMP_DIR}
mkdir -p ${TEMP_DIR}
cp -r web-marker/* ${TEMP_DIR}
cd ${TEMP_DIR}
find . -name CVS -print0 | xargs -0 rm -rf

if [ "${DEV}" == "0" ]; then
    # release packaging     
    release_packager ${TEMP_DIR}
else
    dev_packager ${TEMP_DIR}   
fi

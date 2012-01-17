#!/bin/bash

# convenience script to create Firefox extension

RELEASE_TEMP_DIR="/tmp/web-marker"
DEV_TEMP_DIR="${HOME}/tmp/web-marker"
MANIFEST="chrome.manifest"
VERSION="0.8"
RELEASE=0

TEMP_DIR=${RELEASE_TEMP_DIR}

function release_packager()
{
    dir=$1
    cd ${dir}
    zip -r ../webmarker-${VERSION}.xpi *
}

function dev_packager()
{
    dir=$1
    cd ${dir}
}

while getopts "r" option
do
   case $option in 
   r ) RELEASE=1; 
       TEMP_DIR=${RELEASE_TEMP_DIR};
       ;;
   esac
done

rm -rf ${TEMP_DIR}
mkdir -p ${TEMP_DIR}
cp -r src/* ${TEMP_DIR}
cd ${TEMP_DIR}
find . -name .git -print0 | xargs -0 rm -rf

if [ ${RELEASE} -eq 1 ]; then
    # release packaging     
    release_packager ${TEMP_DIR}
else
    dev_packager ${TEMP_DIR}   
fi

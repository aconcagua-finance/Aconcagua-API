#!/bin/bash

# npm version  --no-git-tag-version prerelease --preid 'rc' -m 'RC V %s'

npm version --no-git-tag-version patch -m 'RC V %s'

#get highest tag number
# VERSION=`git describe --abbrev=0 --tags`
VERSION=${npm_package_version}

echo "ACTUAL VERSION: " $VERSION

#replace . with space so can split into an array
VERSION_BITS=(${VERSION//./ })

#get number parts and increase last one by 1
VNUM1=${VERSION_BITS[0]}
VNUM2=${VERSION_BITS[1]}
VNUM3=${VERSION_BITS[2]}
VNUM3=$((VNUM3+1))

#create new tag
NEW_TAG="rc$VNUM1.$VNUM2.$VNUM3"
#NEW_TAG=${NEW_TAG/v/rc}
echo "Updating $VERSION to $NEW_TAG"

#get current hash and see if it already has a tag
GIT_COMMIT=`git rev-parse HEAD`
NEEDS_TAG=`git describe --contains $GIT_COMMIT 2>/dev/null`

#only tag if no tag already
#if [ -z "$NEEDS_TAG" ]; then
    
    git add -A
    git commit -m "RC $NEW_TAG"
    
    git push

    git tag $NEW_TAG
    echo "Tagged with $NEW_TAG"

    git push --tags
    echo "Pushed TAG $NEW_TAG"
    
# else
#     echo "Already a tag on this commit"
# fi
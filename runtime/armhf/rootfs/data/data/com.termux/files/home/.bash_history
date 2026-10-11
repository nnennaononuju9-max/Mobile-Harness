export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin; grep -A12 -B2 '^Package: node-postcss-selector-parser$' /npm-debs/Packages.all
echo '=== POSTCSS PACKAGES ==='; grep -i '^Package: node-postcss' /npm-debs/Packages.all | head -50; echo; echo '=== EXISTING MODULE ==='; find /usr/share/nodejs /share/nodejs -maxdepth 4 -iname '*postcss*selector*parser*' 2>/dev/null | head -30
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
mkdir -p /share/nodejs/postcss-selector-parser
cd /tmp
curl -fL https://registry.npmjs.org/postcss-selector-parser/-/postcss-selector-parser-6.0.13.tgz -o postcss-selector-parser.tgz
tar -xzf postcss-selector-parser.tgz   -C /share/nodejs/postcss-selector-parser   --strip-components=1
echo
echo '=== TEST MODULE ==='
node -e "console.log(typeof require('postcss-selector-parser'))"
echo
echo '=== TEST NPM ==='
npm -v
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
mkdir -p /share/nodejs/cssesc
cd /tmp
curl -fL https://registry.npmjs.org/cssesc/-/cssesc-3.0.0.tgz -o cssesc.tgz
tar -xzf cssesc.tgz   -C /share/nodejs/cssesc   --strip-components=1
echo
echo '=== TEST cssesc ==='
node -e "console.log(typeof require('cssesc'))"
echo
echo '=== TEST npm ==='
npm -v
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
mkdir -p /share/nodejs/util-deprecate
cd /tmp
curl -fL https://registry.npmjs.org/util-deprecate/-/util-deprecate-1.0.2.tgz -o util-deprecate.tgz
tar -xzf util-deprecate.tgz   -C /share/nodejs/util-deprecate   --strip-components=1
echo
echo '=== TEST util-deprecate ==='
node -e "console.log(typeof require('util-deprecate'))"
echo
echo '=== TEST npm ==='
npm -v
exit

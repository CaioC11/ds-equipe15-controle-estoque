#!/bin/bash
echo `date +%FT%T%Z` "- docker-entrypoint.sh started !"
set -e

list=$(find /usr/share/nginx/html -name 'index-*.js' | head -1)

# usage: file_env VAR [DEFAULT]
#    ie: file_env 'XYZ_DB_PASSWORD' 'example'
# (will allow for "$XYZ_DB_PASSWORD_FILE" to fill in the value of
#  "$XYZ_DB_PASSWORD" from a file, especially for Docker's secrets feature)
file_env() {
        local var="$1"
        local fileVar="${var}_FILE"
        local def="${2:-}"
        if [ "${!var:-}" ] && [ "${!fileVar:-}" ]; then
                echo >&2 "error: both $var and $fileVar are set (but are exclusive)"
                exit 1
        fi
        local val="$def"
        if [ "${!var:-}" ]; then
                val="${!var}"
        elif [ "${!fileVar:-}" ]; then
                val="$(< "${!fileVar}")"
        fi
        export "$var"="$val"
        unset "$fileVar"
}

file_env 'BASEURL' 'controle-estoque-emprestimos'
file_env 'API_URL'
file_env 'KEYCLOAK_PUBLIC_JSON'

if [ -n "$list" ]; then
    if [ -f "${list}.ORIG" ]; then
        cp "${list}.ORIG" "$list"
    else
        cp "$list" "${list}.ORIG"
    fi

    if grep -qE "__controle-estoque-emprestimos_url__|<controle-estoque-emprestimos_apiurl>|\"<controle-estoque-emprestimos_keycloak_json>\"" "$list"; then
        sed -i "s|__controle-estoque-emprestimos_url__|$BASEURL|g" "$list"
        sed -i "s;<controle-estoque-emprestimos_apiurl>;$API_URL;g" "$list"
        sed -i "s;\"<controle-estoque-emprestimos_keycloak_json>\";'$KEYCLOAK_PUBLIC_JSON';g" "$list"
        echo "✅ Runtime injection aplicado ao bundle."
    fi
fi

if grep -q "__controle-estoque-emprestimos_url__" /usr/share/nginx/html/index.html 2>/dev/null; then
    sed -i "s|__controle-estoque-emprestimos_url__|$BASEURL|g" /usr/share/nginx/html/index.html
fi

if grep "try_files" /etc/nginx/conf.d/default.conf -q;
then
  echo "Try file already configured"
else
  sed -i "\|index  index.html index.htm;|a \        try_files \$uri \$uri/ /$BASEURL/index.html;" /etc/nginx/conf.d/default.conf
  sed -i "s|location / {|location /$BASEURL {|g" /etc/nginx/conf.d/default.conf
  sed -i "\|location /$BASEURL|,/}/s|root |alias|" /etc/nginx/conf.d/default.conf
fi

echo `date +%FT%T%Z` "- docker-entrypoint.sh finished..."

exec "$@"

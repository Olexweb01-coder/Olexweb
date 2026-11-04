#!/bin/sh
# stands in for Postfix's sendmail in tests: saves the arguments and the email
echo "$@" > /tmp/fake-sendmail.args; cat > /tmp/fake-sendmail.eml

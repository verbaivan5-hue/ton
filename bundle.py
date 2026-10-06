import os

with open('index.html', 'r') as f:
    html = f.read()

with open('style.css', 'r') as f:
    css = f.read()

with open('app.js', 'r') as f:
    js = f.read()

# Replace <link rel="stylesheet" href="style.css"> with <style>...</style>
html = html.replace('<link rel="stylesheet" href="style.css">', f'<style>\n{css}\n</style>')

# Replace <script src="app.js"></script> with <script>...</script>
html = html.replace('<script src="app.js"></script>', f'<script>\n{js}\n</script>')

with open('kinematics.html', 'w') as f:
    f.write(html)

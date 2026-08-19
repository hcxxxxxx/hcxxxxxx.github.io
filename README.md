# Chengxun Hong's personal website

A simple static website, ready for GitHub Pages.

## Publish it as `username.github.io`

1. Create a new public GitHub repository named exactly `YOUR-GITHUB-USERNAME.github.io`.
2. In this folder, run the commands below, replacing the placeholder with your GitHub username:

   ```bash
   git init
   git add .
   git commit -m "Create personal website"
   git branch -M main
   git remote add origin https://github.com/YOUR-GITHUB-USERNAME/YOUR-GITHUB-USERNAME.github.io.git
   git push -u origin main
   ```

3. On GitHub, open the repository's **Settings → Pages**. Under **Build and deployment**, select **Deploy from a branch**, choose `main` and `/ (root)`, then save.
4. After GitHub finishes deployment, the website will be at `https://YOUR-GITHUB-USERNAME.github.io`.

For later updates, edit `index.html` or `style.css`, then run `git add .`, `git commit -m "Update website"`, and `git push`.

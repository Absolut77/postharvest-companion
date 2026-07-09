
CREATE POLICY "public read templates" ON storage.objects FOR SELECT USING (bucket_id = 'templates');
CREATE POLICY "public insert templates" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'templates');
CREATE POLICY "public update templates" ON storage.objects FOR UPDATE USING (bucket_id = 'templates') WITH CHECK (bucket_id = 'templates');
CREATE POLICY "public delete templates" ON storage.objects FOR DELETE USING (bucket_id = 'templates');

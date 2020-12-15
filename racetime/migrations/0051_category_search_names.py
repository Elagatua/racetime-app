# Generated by Django 3.0.11 on 2020-12-15 18:15

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('racetime', '0050_auto_20201115_1011'),
    ]

    operations = [
        migrations.AddField(
            model_name='category',
            name='search_names',
            field=models.CharField(db_index=True, default='', help_text='A searchable name for the category, e.g. "Pokemon Emerald"', max_length=255),
            preserve_default=False,
        ),
    ]

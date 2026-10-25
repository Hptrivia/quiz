# Pantheon birth country -> continent (for Who Am I?'s 🟨 "same continent").
# North America includes Central America and the Caribbean.
_C = {
 'Europe': """Albania, Andorra, Austria, Belarus, Belgium, Bosnia and Herzegovina, Bulgaria, Croatia, Cyprus, Czech Republic, Czechia,
  Denmark, Estonia, Faroe Islands, Finland, France, Germany, Gibraltar, Greece, Guernsey, Hungary, Iceland, Ireland, Isle of Man, Italy,
  Jersey, Kosovo, Latvia, Liechtenstein, Lithuania, Luxembourg, Malta, Moldova, Monaco, Montenegro, Netherlands, North Macedonia, Norway,
  Poland, Portugal, Romania, Russia, San Marino, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Ukraine, United Kingdom,
  Vatican City, Åland Islands""",
 'Asia': """Afghanistan, Armenia, Azerbaijan, Bahrain, Bangladesh, Bhutan, Brunei, Cambodia, China, Georgia, Hong Kong, India, Indonesia,
  Iran, Iraq, Israel, Japan, Jordan, Kazakhstan, Kuwait, Kyrgyzstan, Laos, Lebanon, Macao, Malaysia, Maldives, Mongolia, Myanmar (Burma),
  Nepal, North Korea, Oman, Pakistan, Palestine, Philippines, Qatar, Saudi Arabia, Singapore, South Korea, Sri Lanka, Syria, Taiwan,
  Tajikistan, Thailand, Timor-Leste, Türkiye, Turkmenistan, United Arab Emirates, Uzbekistan, Vietnam, Yemen""",
 'Africa': """Algeria, Angola, Benin, Botswana, Burkina Faso, Burundi, Cabo Verde, Cameroon, Central African Republic, Chad, Comoros,
  Côte d'Ivoire, Democratic Republic of the Congo, Djibouti, Egypt, Equatorial Guinea, Eritrea, Eswatini, Ethiopia, Gabon, Ghana, Guinea,
  Guinea-Bissau, Kenya, Lesotho, Liberia, Libya, Madagascar, Malawi, Mali, Mauritania, Mauritius, Mayotte, Morocco, Mozambique, Namibia,
  Niger, Nigeria, Republic of the Congo, Rwanda, Réunion, São Tomé and Príncipe, Senegal, Seychelles, Sierra Leone, Somalia, South Africa,
  South Sudan, Sudan, Swaziland, Tanzania, The Gambia, Togo, Tunisia, Uganda, Zambia, Zimbabwe""",
 'North America': """American Samoa, Anguilla, Antigua and Barbuda, Aruba, Bahamas, The, Barbados, Belize, Bermuda, British Virgin Islands,
  Canada, Cayman Islands, Costa Rica, Cuba, Curaçao, Dominica, Dominican Republic, El Salvador, Greenland, Grenada, Guadeloupe, Guatemala,
  Haiti, Honduras, Jamaica, Martinique, Mexico, Nicaragua, Panama, Puerto Rico, Saint Kitts and Nevis, Saint Lucia,
  Saint Vincent and the Grenadines, The Bahamas, Trinidad and Tobago, U.S. Virgin Islands, United States""",
 'South America': """Argentina, Bolivia, Brazil, Chile, Colombia, Ecuador, Falkland Islands (Islas Malvinas), French Guiana, Guyana,
  Paraguay, Peru, Suriname, Uruguay, Venezuela""",
 'Oceania': """Australia, Cook Islands, Federated States of Micronesia, Fiji, French Polynesia, Guam, Kiribati, Marshall Islands,
  Micronesia, Nauru, New Caledonia, New Zealand, Niue, Norfolk Island, Northern Mariana Islands, Palau, Papua New Guinea, Samoa,
  Solomon Islands, Tonga, Tuvalu, Vanuatu""",
 'Antarctica': 'Antarctica',
}
CONTINENT = {}
for cont, names in _C.items():
    for n in names.replace('\n', ' ').split(','):
        n = n.strip()
        if n:
            CONTINENT[n] = cont
CONTINENT['Bahamas, The'] = 'North America'  # name contains a comma
